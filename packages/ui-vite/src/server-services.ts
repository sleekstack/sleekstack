import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AnalyzeError, PropertySchema, TaggedErrorSchema, TypeSchema } from '@sleekstack/analyze'
import { normalizePath, type Plugin } from 'vite'

/** Where the Server Service modules' types go. */
export interface ServerServicesOptions {
  /** The declaration of `virtual:sleek/server` and `virtual:sleek/server-registry`, relative to the Vite root. Default `src/server.gen.d.ts`. */
  readonly serverDeclaration?: string
}

const CLIENT = 'virtual:sleek/server'
const REGISTRY = 'virtual:sleek/server-registry'
const MODULES = [CLIENT, REGISTRY]
/** Generated code imports it; ui-vite itself never does. */
const START_CLIENT = '@sleekstack/start/client'
const SOURCE = /\.[cm]?[jt]sx?$/
const SERVER_FILE = /\.server\.[cm]?[jt]sx?$/

/** A Server Service as the generator needs it; files relative to the tsconfig directory. */
interface Contract {
  readonly name: string
  readonly file: string
  readonly methods: ReadonlyArray<{
    readonly name: string
    readonly schema: {
      readonly input: TypeSchema
      readonly success: TypeSchema
      readonly error: readonly TaggedErrorSchema[]
    }
  }>
}

/** Names the class `name` exported from `file` (relative to the tsconfig directory) in the generated module. */
type Alias = (file: string, name: string) => string

const PRIMITIVE = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  null: 'Null',
  undefined: 'Undefined',
  void: 'Void',
}

const fields = (props: readonly PropertySchema[], alias: Alias): string =>
  props.length
    ? `{ ${props
        .map((p) => {
          const type = printSchema(p.type, alias)
          return `${JSON.stringify(p.name)}: ${p.optional ? `Schema.optional(${type})` : type}`
        })
        .join(', ')} }`
    : '{}'

/** The Schema source of a Type to Schema description; a tagged error is its class, named through `alias`. */
export const printSchema = (t: TypeSchema | TaggedErrorSchema, alias: Alias): string => {
  switch (t.kind) {
    case 'literal':
      return `Schema.Literal(${JSON.stringify(t.value)})`
    case 'union':
      return `Schema.Union(${t.members.map((m) => printSchema(m, alias)).join(', ')})`
    case 'array': {
      const array = `Schema.Array(${printSchema(t.element, alias)})`
      return t.readonly ? array : `Schema.mutable(${array})`
    }
    case 'object':
      return `Schema.Struct(${fields(t.properties, alias)})`
    case 'taggedError':
      return `taggedError(${alias(t.file, t.name)}, ${fields(t.fields, alias)})`
    default:
      return `Schema.${PRIMITIVE[t.kind]}`
  }
}

const errorSchema = (errors: readonly TaggedErrorSchema[], alias: Alias) =>
  errors.length === 0
    ? ''
    : `, error: ${errors.length === 1 ? printSchema(errors[0]!, alias) : `Schema.Union(${errors.map((e) => printSchema(e, alias)).join(', ')})`}`

/** The registry entries as module code, importing each Tag and error class from its contract file (absolute, under `root`). */
const entriesCode = (contracts: readonly Contract[], root: string): string => {
  const imports = new Map<string, string>()
  const alias: Alias = (file, name) => {
    const from = JSON.stringify(normalizePath(path.resolve(root, file)))
    const line = (as: string) => `import { ${name} as ${as} } from ${from}\n`
    const key = `${from}#${name}`
    if (!imports.has(key)) imports.set(key, line(`${name}_${imports.size}`))
    return `${name}_${[...imports.keys()].indexOf(key)}`
  }
  const entries = contracts.map(
    (c) =>
      `  { tag: ${alias(c.file, c.name)}, methods: { ${c.methods
        .map(
          ({ name, schema }) =>
            `${JSON.stringify(name)}: { input: ${printSchema(schema.input, alias)}, success: ${printSchema(schema.success, alias)}${errorSchema(schema.error, alias)} }`,
        )
        .join(', ')} } },\n`,
  )
  return `import { Schema } from 'effect'
import { serverClients, taggedError } from '${START_CLIENT}'
${[...imports.values()].join('')}const entries = [
${entries.join('')}]
`
}

/** Both modules' types, each Tag named by `import()` from its contract file, relative to the declaration's directory. */
const declarationOf = (contracts: readonly Contract[], root: string, dir: string): string => {
  const tag = (c: Contract) => {
    const rel = path.posix.relative(dir, normalizePath(path.resolve(root, c.file))).replace(SOURCE, '')
    return `import(${JSON.stringify(rel.startsWith('.') ? rel : `./${rel}`)}).${c.name}`
  }
  const tags = contracts.map(tag).join(' | ') || 'never'
  return `// Written by @sleekstack/ui-vite from the Server Service contracts; do not edit.
declare module '${CLIENT}' {
  const layer: import('effect').Layer.Layer<${tags}>
  export default layer
}
declare module '${REGISTRY}' {
  const services: ReadonlyArray<import('${START_CLIENT}').ServerServiceEntry<${tags}>>
  export default services
}
`
}

/** What the contracts give: both modules and their declaration, or the error that fails every load. */
type Generated =
  | { readonly client: string; readonly registry: string; readonly declaration: string; readonly empty: boolean }
  | { readonly error: string }

/** `@sleekstack/analyze`'s Server Service pass, loaded through jiti as `analyze.ts` does (it ships as TypeScript source). */
const readContracts = async (project: string): Promise<{ contracts: Contract[]; errors: readonly AnalyzeError[] }> => {
  const { createJiti } = await import('jiti')
  const { analyzeServerServices } = await createJiti(import.meta.url).import<typeof import('@sleekstack/analyze')>(
    '@sleekstack/analyze',
  )
  const { services, errors } = analyzeServerServices({ project })
  return {
    errors,
    contracts: services.map((s) => ({
      name: s.name,
      file: s.location.file,
      methods: s.methods.map((m) => ({ name: m.name, schema: m.schema })),
    })),
  }
}

/**
 * Serves `virtual:sleek/server` (default export: `serverClients(...)`, a Layer providing every Server Service Tag over
 * the wire) and `virtual:sleek/server-registry` (default export: the entries for `start({ services })`), generated
 * from the contracts the analyzer reads in the Vite root's `tsconfig.json`. Both import each Tag and error class from
 * its contract file, never an implementation. An analyzer error fails the load naming file:line: no partial client.
 * Their types are kept in `serverDeclaration`, rewritten only when its text changes (and not created while there are
 * no contracts). In dev, a source change that
 * changes the generated code invalidates both modules in every environment and reloads the page; a `*.server.ts`
 * (implementation) change is ignored.
 */
export const serverServices = (options: ServerServicesOptions = {}): Plugin => {
  let project = ''
  let root = ''
  let declarationFile = ''
  let generated: Promise<Generated> | undefined
  const generate = async (): Promise<Generated> => {
    try {
      const { contracts, errors } = await readContracts(project)
      if (errors.length)
        return {
          error: `sleekstack: Server Service contracts have ${errors.length} error(s):\n${errors
            .map((e) => `${path.resolve(root, e.file)}:${e.line} ${e.code}: ${e.message}`)
            .join('\n')}`,
        }
      const entries = entriesCode(contracts, root)
      return {
        client: `${entries}export default serverClients(entries)\n`,
        registry: `${entries}export default entries\n`,
        declaration: declarationOf(contracts, root, normalizePath(path.dirname(declarationFile))),
        empty: contracts.length === 0,
      }
    } catch (cause) {
      return {
        error: `sleekstack: reading Server Service contracts crashed: ${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}`,
      }
    }
  }
  const current = () => (generated ??= generate())
  const writeDeclaration = (g: Generated) => {
    if ('error' in g) return
    // An app with no contracts gets no file.
    if (!fs.existsSync(declarationFile) ? g.empty : fs.readFileSync(declarationFile, 'utf8') === g.declaration) return
    fs.mkdirSync(path.dirname(declarationFile), { recursive: true })
    fs.writeFileSync(declarationFile, g.declaration)
  }
  return {
    name: 'sleekstack:server-services',
    sharedDuringBuild: true,
    configResolved(config) {
      root = config.root
      project = path.join(root, 'tsconfig.json')
      declarationFile = path.resolve(root, options.serverDeclaration ?? 'src/server.gen.d.ts')
      generated = undefined
    },
    watchChange() {
      if (this.environment.mode === 'build') generated = undefined
    },
    async buildStart() {
      writeDeclaration(await current())
    },
    resolveId: {
      filter: { id: new RegExp(`^(${MODULES.join('|')})$`) },
      handler: (id) => `\0${id}`,
    },
    load: {
      filter: { id: new RegExp(`^\0(${MODULES.join('|')})$`) },
      async handler(id) {
        const g = await current()
        if ('error' in g) return this.error(g.error)
        return id === `\0${CLIENT}` ? g.client : g.registry
      },
    },
    configureServer(server) {
      // ponytail: re-reads every contract (a whole TypeScript program) per non-server source change; key the rerun on
      // the contracts' import graph if large projects stall.
      const changed = async (file: string) => {
        if (!SOURCE.test(file) || SERVER_FILE.test(file) || file.endsWith('.d.ts') || file.includes('/node_modules/'))
          return
        const before = await current()
        generated = undefined
        const after = await current()
        writeDeclaration(after)
        if (JSON.stringify(before) === JSON.stringify(after)) return
        for (const env of Object.values(server.environments))
          for (const id of MODULES) {
            const mod = env.moduleGraph.getModuleById(`\0${id}`)
            if (mod) env.moduleGraph.invalidateModule(mod)
          }
        server.ws.send({ type: 'full-reload' })
      }
      const on = (file: string) => void changed(normalizePath(file))
      server.watcher.on('add', on).on('change', on).on('unlink', on)
    },
  }
}
