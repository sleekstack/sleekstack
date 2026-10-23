import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AnalyzeError, PropertySchema, TaggedErrorSchema, TypeSchema } from '@sleekstack/analyze'
import { type Environment, normalizePath, type Plugin } from 'vite'
import { matchOrder, type RoutesOptions, scan, sortKey } from './routes.js'

/**
 * Where the Server Service modules' types go, and where the server code lives. `routesDir` is the page routes'
 * directory, which a Controller's path must not repeat.
 */
export interface ServerServicesOptions extends RoutesOptions {
  /** The declaration of `virtual:sleek/server`, `virtual:sleek/server-registry`, `virtual:sleek/server-app` and `virtual:sleek/rpc`, relative to the Vite root. Default `src/server.gen.d.ts`. */
  readonly serverDeclaration?: string
  /** The server directory, relative to the Vite root; a `_defaults.ts` under it is server-only. Default `server`. */
  readonly serverDir?: string
  /** The directory of the Controllers (`*.controller.ts`), relative to the Vite root. Default `<serverDir>/routes`. */
  readonly controllersDir?: string
}

const CLIENT = 'virtual:sleek/server'
const REGISTRY = 'virtual:sleek/server-registry'
/** The generated Tags, one per RPC File or RPC Manifest service: client-safe, so pages import them. */
const RPC = 'virtual:sleek/rpc'
const MODULES = [CLIENT, REGISTRY, RPC]
/** The discovered app `start()` reads. */
const SERVER_APP = 'virtual:sleek/server-app'
const CONTROLLER = /\.controller\.ts$/
const DEFAULTS = '_defaults.ts'
const RPC_FILE = /\.rpc\.ts$/
const MANIFEST = 'rpc.ts'
/** A Layer File: found anywhere in the TypeScript program but tests, by the analyzer's Layer File pass. */
const LAYER_FILE = /\.layer\.ts$/
/** The server directory's files that the discovered app imports by name. */
const RESERVED = new Set([DEFAULTS, MANIFEST, '_app.ts'])
const GROUP = /^\(.+\)$/
const VIRTUAL = [...MODULES, SERVER_APP].join('|')
/**
 * `@sleekstack/start` imports a stand-in for the discovered app (nothing discovered) as `./discovered` from here. The
 * redirect needs Vite to process `start`, as it must anyway: its dist is not loadable by Node alone (extensionless
 * relative imports), so an externalized `start` fails to load rather than missing the discovered app.
 */
const START_MODULE = /[\\/]start[\\/](?:dist|src)[\\/]start\.[jt]s$/
const STAND_IN = './discovered'
/** Generated code imports it; ui-vite itself never does. */
const START_CLIENT = '@sleekstack/start/client'
const SOURCE = /\.[cm]?[jt]sx?$/
/** A Server Service implementation: the watcher skips it, as its change never changes a contract. */
const IMPLEMENTATION = /\.server\.[cm]?[jt]sx?$/

/** A Server Service as the generator needs it; files relative to the tsconfig directory, or `virtual:sleek/rpc` for a generated Tag. */
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

/**
 * Names the export `name` of `file` (relative to the tsconfig directory, or absolute) in the generated module; `'*'`
 * names the whole module.
 */
type Alias = (file: string, name: string) => string

/** `alias` over one import map, and the map's import lines, each file absolute under `root`. */
const importMap = (root: string) => {
  const names = new Map<string, string>()
  let lines = ''
  const alias: Alias = (file, name) => {
    const from = JSON.stringify(file === RPC ? RPC : normalizePath(path.resolve(root, file)))
    const key = `${from}#${name}`
    let as = names.get(key)
    if (as === undefined) {
      // `$<n>` never equals a `<name>_<n>`.
      as = name === '*' ? `$${names.size}` : `${name}_${names.size}`
      names.set(key, as)
      lines += name === '*' ? `import * as ${as} from ${from}\n` : `import { ${name} as ${as} } from ${from}\n`
    }
    return as
  }
  return { alias, imports: () => lines }
}

const PRIMITIVE = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  null: 'Null',
  undefined: 'Undefined',
  void: 'Void',
}
/** A path or query value read from its text: a finite decimal (no `NaN`, `Infinity`, hex or exponent); `true` or `false`. */
const FROM_STRING = {
  number:
    'Schema.transform(Schema.String.pipe(Schema.pattern(/^-?\\d+(\\.\\d+)?$/)), Schema.Finite, { strict: true, decode: Number, encode: String })',
  boolean: 'Schema.BooleanFromString',
}

/** JSON drops an `undefined` property, so a property that may be `undefined` may also be absent on the wire. */
const mayBeUndefined = (t: TypeSchema): boolean =>
  t.kind === 'undefined' || (t.kind === 'union' && t.members.some(mayBeUndefined))

const fields = (props: readonly PropertySchema[], alias: Alias): string =>
  props.length
    ? `{ ${props
        .map((p) => {
          const type = printSchema(p.type, alias)
          return `${JSON.stringify(p.name)}: ${p.optional || mayBeUndefined(p.type) ? `Schema.optional(${type})` : type}`
        })
        .join(', ')} }`
    : '{}'

/** The Schema source of a Type to Schema description; a tagged error class and a referenced Schema are named through `alias`. */
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
    case 'record': {
      const record = `Schema.Record({ key: Schema.String, value: ${printSchema(t.value, alias)} })`
      return t.readonly ? record : `Schema.mutable(${record})`
    }
    case 'object':
      return `Schema.Struct(${fields(t.properties, alias)})`
    case 'taggedError':
      return t.schema ? alias(t.file, t.name) : `taggedError(${alias(t.file, t.name)}, ${fields(t.fields, alias)})`
    case 'ref':
      return alias(t.file, t.name)
    default:
      return 'codec' in t && t.codec ? FROM_STRING[t.kind] : `Schema.${PRIMITIVE[t.kind]}`
  }
}

const errorSchema = (errors: readonly TaggedErrorSchema[], alias: Alias) =>
  errors.length === 0
    ? ''
    : `, error: ${errors.length === 1 ? printSchema(errors[0]!, alias) : `Schema.Union(${errors.map((e) => printSchema(e, alias)).join(', ')})`}`

/** One registry entry (`ServerServiceEntry` of `@sleekstack/start`) as an expression. */
const entryCode = (c: Contract, alias: Alias) =>
  `{ tag: ${alias(c.file, c.name)}, methods: { ${c.methods
    .map(
      ({ name, schema }) =>
        `${JSON.stringify(name)}: { input: ${printSchema(schema.input, alias)}, success: ${printSchema(schema.success, alias)}${errorSchema(schema.error, alias)} }`,
    )
    .join(', ')} } }`

/** The registry entries as module code, importing each Tag and error class from its contract file (absolute, under `root`). */
const entriesCode = (contracts: readonly Contract[], root: string): string => {
  const { alias, imports } = importMap(root)
  const entries = contracts.map((c) => `  ${entryCode(c, alias)},\n`)
  return `import { Schema } from 'effect'
import { serverClients, taggedError } from '${START_CLIENT}'
${imports()}const entries = [
${entries.join('')}]
`
}

/** The `import()` type of the absolute `file` from the declaration's directory `dir`. */
const importType = (dir: string, file: string) => {
  const rel = path.posix.relative(dir, normalizePath(file)).replace(SOURCE, '')
  return `import(${JSON.stringify(rel.startsWith('.') ? rel : `./${rel}`)})`
}

/**
 * The generated Tags' types: each Tag's service is its methods (an RPC File's own, or the Controller Methods a Manifest
 * entry wraps) with `R` erased and `NetworkError | DecodeError` added (`GeneratedServiceShape`), and each Tag's key is
 * a `GeneratedServices` member of the discovered app.
 */
const rpcDeclaration = (rpc: readonly RpcService[], dir: string) => {
  if (rpc.length === 0) return ''
  const tags = rpc.map(({ contract: { name, methods }, file, implementations }) => {
    const picked = methods.map((m) => JSON.stringify(m.name)).join(' | ') || 'never'
    const shape = RPC_FILE.test(file)
      ? `Pick<typeof ${importType(dir, file)}, ${picked}>`
      : `{ ${implementations.map((m) => `readonly ${JSON.stringify(m.method)}: typeof ${importType(dir, m.file)}[${JSON.stringify(m.name)}]`).join('; ')} }`
    return `
  export interface ${name} {
    readonly '${RPC}': ${JSON.stringify(name)}
  }
  export const ${name}: import('effect').Context.Tag<${name}, import('@sleekstack/start').GeneratedServiceShape<${shape}>>`
  })
  return `declare module '${RPC}' {${tags.join('')}
}
declare module '${SERVER_APP}' {
  /** Each generated Server Service Tag (RPC Files and the RPC Manifest), by key. */
  export interface GeneratedServices {${rpc.map(({ contract: { name } }) => `\n    readonly ${name}: import('${RPC}').${name}`).join('')}
  }
}
`
}

/** The modules' types, each Tag named by `import()` from its contract file, relative to the declaration's directory. */
const declarationOf = (contracts: readonly Contract[], rpc: readonly RpcService[], root: string, dir: string) => {
  const tag = (c: Contract) => `${importType(dir, path.resolve(root, c.file))}.${c.name}`
  const generated = rpc.map((s) => `import('${RPC}').${s.contract.name}`)
  const tags = [...contracts.map(tag), ...generated].join(' | ') || 'never'
  const classes = [...contracts.map(tag), ...generated].map((t) => `typeof ${t}`).join(' | ') || 'never'
  return `declare module '${CLIENT}' {
  const layer: import('effect').Layer.Layer<${tags}>
  export default layer
}
declare module '${REGISTRY}' {
  const services: ReadonlyArray<import('${START_CLIENT}').ServerServiceEntryOf<${classes}>>
  export default services
}
${rpcDeclaration(rpc, dir)}`
}

/** What the contracts and RPC Files give: the client-side modules and their declaration, or the error that fails every load. */
type Generated =
  | {
      readonly client: string
      readonly registry: string
      readonly rpc: string
      readonly declaration: string
      readonly empty: boolean
    }
  | { readonly error: string }

let analyzerModule: Promise<typeof import('@sleekstack/analyze')> | undefined
/** `@sleekstack/analyze`, loaded once through jiti as `analyze.ts` does (it ships as TypeScript source). */
const analyzer = () =>
  (analyzerModule ??= import('jiti').then(({ createJiti }) =>
    createJiti(import.meta.url).import<typeof import('@sleekstack/analyze')>('@sleekstack/analyze'),
  ))

/** The load error for analyzer `errors` about `what`, each at its file:line. */
const failed = (what: string, errors: readonly AnalyzeError[], root: string) =>
  `sleekstack: ${what} have ${errors.length} error(s):\n${errors
    .map((e) => `${path.resolve(root, e.file)}:${e.line} ${e.code}: ${e.message}`)
    .join('\n')}`

/** The analyzer's Server Service pass over the tsconfig at `project`. */
const readContracts = async (
  project: string,
  serverDir: string,
): Promise<{ contracts: Contract[]; errors: readonly AnalyzeError[] }> => {
  const { analyzeServerServices } = await analyzer()
  const { services, errors } = analyzeServerServices({ project, serverDir })
  return {
    // The client build reports that one itself, with the chain it loaded; the server build is not bound by it.
    errors: errors.filter((e) => e.code !== 'ServerFileInClientGraph'),
    contracts: services.map((s) => ({
      name: s.name,
      file: s.location.file,
      methods: s.methods.map((m) => ({ name: m.name, schema: m.schema })),
    })),
  }
}

/**
 * A generated Server Service: its entry (the Tag is `virtual:sleek/rpc`'s), its RPC File or the Manifest, the
 * `_defaults.ts` chain, outer first, and each method's implementation, the export `name` of `file` (an RPC File's own
 * function, or the verb of the Controller a Manifest entry wraps); paths absolute.
 */
interface RpcService {
  readonly contract: Contract
  readonly file: string
  readonly defaults: readonly string[]
  readonly implementations: ReadonlyArray<{ readonly method: string; readonly file: string; readonly name: string }>
}

/** The RPC Files' and the Manifest's services and the code of `virtual:sleek/rpc`, or the error that fails every load. */
type Rpcs = { readonly services: readonly RpcService[]; readonly code: string } | { readonly error: string }

/** The `_defaults.ts` files among `files` from `serverDir` down to a file's directory, outer first; none outside it. */
const defaultsChain = (serverDir: string, files: readonly string[]) => {
  const defaults = new Set(files.filter((f) => path.posix.basename(f) === DEFAULTS))
  return (file: string) => {
    const rel = path.posix.relative(serverDir, path.posix.dirname(file))
    if (rel.split('/')[0] === '..' || path.isAbsolute(rel)) return []
    const dirs = rel ? rel.split('/') : []
    return ['', ...dirs.map((_, i) => dirs.slice(0, i + 1).join('/'))]
      .map((d) => path.posix.join(serverDir, d, DEFAULTS))
      .filter((f) => defaults.has(f))
  }
}

/**
 * The analyzer's RPC pass over the tsconfig at `project` (`root` is its directory), run only when a `*.rpc.ts` or the
 * Manifest is under `serverDir`. Throws naming an RPC File the analyzer did not read, or as `discoverControllers` does.
 */
const readRpc = async (
  project: string,
  root: string,
  dirs: { readonly serverDir: string; readonly controllersDir: string; readonly routesDir: string },
): Promise<Rpcs> => {
  const files = filesUnder(dirs.serverDir)
  const sources = files.filter((f) => RPC_FILE.test(f))
  const manifest = `${dirs.serverDir}/${MANIFEST}`
  if (sources.length === 0 && !files.includes(manifest)) return { services: [], code: '' }
  const { analyzeRpc } = await analyzer()
  const report = analyzeRpc({ project, serverDir: dirs.serverDir, controllersDir: dirs.controllersDir })
  // As for the contracts: the client build reports that one itself, with the chain it loaded.
  const errors = report.errors.filter((e) => e.code !== 'ServerFileInClientGraph')
  if (errors.length) return { error: failed('RPC Files', errors, root) }
  const defaultsOf = defaultsChain(dirs.serverDir, files)
  const wrapped = report.services.some((s) => s.methods.some((m) => m.controller))
  const controllers = new Map((wrapped ? await discoverControllers(dirs) : []).map((c) => [c.route, c.file]))
  const services = report.services.map(({ name, file: relative, methods }) => {
    const file = normalizePath(path.resolve(root, relative))
    return {
      contract: { name, file: RPC, methods: methods.map((m) => ({ name: m.name, schema: m.schema })) },
      file,
      defaults: defaultsOf(file),
      implementations: methods.map((m) =>
        m.controller
          ? { method: m.name, file: controllers.get(m.controller.route)!, name: m.controller.method }
          : { method: m.name, file, name: m.name },
      ),
    }
  })
  const read = new Set(services.map((s) => s.file))
  const unread = sources.find((f) => !read.has(f))
  if (unread)
    throw new Error(
      `sleekstack: RPC File ${unread} is not in the TypeScript project of the Vite root, so its methods cannot be read; include it in tsconfig.json`,
    )
  const tags = services.map(
    (s) => `export const ${s.contract.name} = Context.GenericTag(${JSON.stringify(s.contract.name)})\n`,
  )
  return { services, code: `import { Context } from 'effect'\n${tags.join('')}` }
}

/** The Layer Files in composition order, and the Server Root when it exports `onError`; paths absolute. */
interface LayerFiles {
  readonly files: readonly string[]
  readonly onError: string | undefined
}

/** The analyzer's Layer File pass over the tsconfig at `project` (`root` is its directory). */
const readLayerFiles = async (
  project: string,
  root: string,
  serverDir: string,
): Promise<LayerFiles | { error: string }> => {
  const { analyzeLayerFiles } = await analyzer()
  const { layerFiles, serverRoot, errors } = analyzeLayerFiles({ project, serverDir })
  if (errors.length) return { error: failed('Layer Files', errors, root) }
  const absolute = (file: string) => normalizePath(path.resolve(root, file))
  return {
    files: layerFiles.map((f) => absolute(f.file)),
    onError: serverRoot?.onError ? absolute(serverRoot.file) : undefined,
  }
}

/** A discovered Controller: its file, route name, URL pattern and the `_defaults.ts` files above it, outer first. */
export interface DiscoveredController {
  readonly file: string
  readonly route: string
  readonly pattern: string
  readonly defaults: readonly string[]
}

/** The files under `dir`, none when it does not exist. */
const filesUnder = (dir: string) =>
  (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) : []).map((f) =>
    normalizePath(path.join(dir, f)),
  )

/**
 * The Controllers under `controllersDir` in match order, with the route derivation of `@sleekstack/analyze`, each
 * with every `_defaults.ts` from `serverDir` down to its directory. Paths are absolute. Throws naming the file for a
 * Controller outside `controllersDir` (found there or under `serverDir`), an invalid segment, an optional or splat
 * segment that is not last, or a URL under the reserved `/_sleek/` (a `_sleek` directory, not a route otherwise); and
 * naming both files for two Controllers, or a Controller and a page route under `routesDir`, at one path.
 */
export const discoverControllers = async ({
  serverDir,
  controllersDir,
  routesDir,
}: {
  readonly serverDir: string
  readonly controllersDir: string
  readonly routesDir: string
}): Promise<DiscoveredController[]> => {
  const files = [...new Set([serverDir, controllersDir].flatMap(filesUnder))]
  const sources = files.filter((f) => CONTROLLER.test(f))
  if (sources.length === 0) return []
  const { controllerRoute } = await analyzer()
  const defaultsOf = defaultsChain(serverDir, files)
  const controllers = sources
    .flatMap((file) => {
      const route = controllerRoute(controllersDir, file)
      if (route) return [{ file, route: route.route, pattern: route.pattern, defaults: defaultsOf(file) }]
      const [top] = path.posix
        .relative(controllersDir, file)
        .split('/')
        .slice(0, -1)
        .filter((s) => !GROUP.test(s))
      if (top === '_sleek')
        throw new Error(
          `sleekstack: invalid Controller file ${file}: its URL would start with /_sleek/, which is reserved`,
        )
      return []
    })
    .sort((a, b) => matchOrder(a.pattern, b.pattern))
  const byPath = new Map<string, DiscoveredController>()
  for (const c of controllers) {
    const other = byPath.get(sortKey(c.pattern))
    if (other) throw new Error(`sleekstack: Controller files ${other.file} and ${c.file} both give path ${c.pattern}`)
    byPath.set(sortKey(c.pattern), c)
  }
  for (const page of scan(routesDir).found) {
    const c = byPath.get(sortKey(page.path))
    if (c)
      throw new Error(`sleekstack: Controller file ${c.file} and route file ${page.file} both give path ${c.pattern}`)
  }
  return controllers
}

/** A Controller's methods as the generator needs them, by the analyzer's Controller pass. */
type ControllerMethods = ReadonlyArray<{
  readonly name: string
  readonly schema: { readonly input: TypeSchema; readonly success: TypeSchema | undefined }
}>

/** The analyzer's Controller pass over the tsconfig at `project`: each Controller's methods by route name. */
const readControllers = async (project: string, serverDir: string, controllersDir: string) => {
  const { analyzeControllers } = await analyzer()
  const { controllers, errors } = analyzeControllers({ project, serverDir, controllersDir })
  const methods = new Map<string, ControllerMethods>(
    controllers.map((c) => [c.route, c.methods.map(({ name, schema }) => ({ name, schema }))]),
  )
  return { methods, errors }
}

/** `params` and `query` are always given, so an optional one decodes as its defined members. */
const defined = (t: TypeSchema): TypeSchema => {
  if (t.kind !== 'union') return t
  const members = t.members.filter((m) => m.kind !== 'undefined')
  return members.length === 1 ? members[0]! : { kind: 'union', members }
}

/**
 * The discovered app's module: each Controller's entry (`ControllerEntry` of `@sleekstack/start`), with its methods'
 * Schemas from `read` and its option chain from the files' exports; each RPC File's service (`DiscoveredService`: its
 * entry, its implementation Layer from `serviceLayer` over the file's methods and `wrap`, and its option chain without
 * `wrap`); the Layer Files' `layer`, each over the ones before it (composition order), and the Server Root's `onError`;
 * the page router over `virtual:sleekstack/routes` when `pages` is given; and `isControllerPath`, the dev servers'
 * forwarding predicate. Throws naming a Controller the analyzer did not read.
 */
const appCode = (
  controllers: readonly DiscoveredController[],
  read: ReadonlyMap<string, ControllerMethods>,
  pages: { readonly notFound: boolean } | undefined,
  root: string,
  rpc: readonly RpcService[],
  layers: LayerFiles,
): string => {
  if (controllers.length === 0 && !pages && rpc.length === 0 && layers.files.length === 0 && !layers.onError)
    return 'export default { controllers: [] }\nexport const isControllerPath = () => false\n'
  const { alias, imports } = importMap(root)
  const entries = controllers.map((c) => {
    const methods = read.get(c.route)
    if (!methods)
      throw new Error(
        `sleekstack: Controller file ${c.file} is not in the TypeScript project of the Vite root, so its methods cannot be read; include it in tsconfig.json`,
      )
    const method = ({ name, schema }: ControllerMethods[number]) => {
      const parts = schema.input.kind === 'object' ? schema.input.properties : []
      const part = (p: PropertySchema) =>
        `, ${p.name}: ${printSchema(p.name === 'body' ? p.type : defined(p.type), alias)}`
      const success = schema.success ? `, success: ${printSchema(schema.success, alias)}` : ''
      return `${name}: { run: ${alias(c.file, '*')}.${name}${parts.map(part).join('')}${success} }`
    }
    const chain = [...c.defaults, c.file].map(
      (f) => `options(${JSON.stringify(normalizePath(path.relative(root, f)))}, ${alias(f, '*')})`,
    )
    return `  { route: ${JSON.stringify(c.route)}, pattern: ${JSON.stringify(c.pattern)}, methods: { ${methods.map(method).join(', ')} }, options: [${chain.join(', ')}] },\n`
  })
  const limits = (file: string, options: string) =>
    `limits(${JSON.stringify(normalizePath(path.relative(root, file)))}, ${options})`
  const services = rpc.map(({ contract, file, defaults, implementations }) => {
    // The Manifest's options are its default export's, an RPC File's its named exports.
    const own = RPC_FILE.test(file) ? alias(file, '*') : `manifest(${alias(file, '*')})`
    const methods = implementations
      .map((m) => `${JSON.stringify(m.method)}: ${alias(m.file, '*')}.${m.name}`)
      .join(', ')
    const chain = [...defaults.map((f) => limits(f, alias(f, '*'))), limits(file, own)]
    return `      { entry: ${entryCode(contract, alias)}, layer: serviceLayer(${alias(RPC, contract.name)}, { ${methods} }, ${own}.wrap), options: [${chain.join(', ')}] },\n`
  })
  const manifest = rpc.some((s) => !RPC_FILE.test(s.file))
  // `Layer.provideMerge(next, before)`: each Layer File gets what the files before it provide.
  const layer = layers.files
    .map((f) => alias(f, 'default'))
    .reduce<string | undefined>((before, next) => (before ? `Layer.provideMerge(${next}, ${before})` : next), undefined)
  const onError = layers.onError && alias(layers.onError, 'onError')
  const notFound = pages?.notFound ? 'routes.notFound' : '() => jsx(Fragment, {})'
  return `import { ${layer ? 'Layer, ' : ''}Schema } from 'effect'
import { bind, ${pages ? 'router, ' : ''}segments } from '@sleekstack/router'
${rpc.length ? `import { serviceLayer } from '@sleekstack/start'\nimport { taggedError } from '${START_CLIENT}'\n` : ''}${pages ? `import * as routes from 'virtual:sleekstack/routes'\n` : ''}${pages && !pages.notFound ? `import { Fragment, jsx } from '@sleekstack/ui/jsx-runtime'\n` : ''}${imports()}const options = (file, m) => ({ file, wrap: m.wrap, bodyLimit: m.bodyLimit, origins: m.origins })
${rpc.length ? 'const limits = (file, m) => ({ file, bodyLimit: m.bodyLimit, origins: m.origins })\n' : ''}${
    // `rpc(services, options)` gives both; a plain table has no options.
    manifest
      ? "const manifest = (m) => ('services' in m.default && 'options' in m.default ? m.default.options : {})\n"
      : ''
  }const controllers = [
${entries.join('')}]
${pages ? 'let built\n' : ''}${rpc.length ? 'let services\n' : ''}${layer ? 'let layer\n' : ''}export default {
  controllers,
${onError ? `  onError: ${onError},\n` : ''}${layer ? `  get layer() {\n    return (layer ??= ${layer})\n  },\n` : ''}${
    // Built on first read: `@sleekstack/start` is still evaluating while it imports this module.
    rpc.length ? `  get services() {\n    return (services ??= [\n${services.join('')}    ])\n  },\n` : ''
  }${pages ? `  get router() {\n    return (built ??= router({ table: routes.table, pages: routes.pages, notFound: ${notFound} }))\n  },\n` : ''}}
const decode = (segment) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
export const isControllerPath = (pathname) => {
  const actual = segments(pathname).map(decode)
  return controllers.some((c) => bind(segments(c.pattern), actual) !== undefined)
}
`
}

/** The discovered Controllers and the module serving them, or the error that fails the discovered app's load. */
type Discovered =
  | {
      readonly controllers: readonly DiscoveredController[]
      readonly layerFiles: readonly string[]
      readonly code: string
    }
  | { readonly error: string }

/** The Controllers section of the declaration: each route name's URL pattern, in match order, and module. */
const controllersDeclaration = (controllers: readonly DiscoveredController[], dir: string) => {
  if (controllers.length === 0) return ''
  const entries = (value: (c: DiscoveredController) => string) =>
    controllers.map((c) => `\n    readonly ${JSON.stringify(c.route)}: ${value(c)}`).join('')
  return `declare module '${SERVER_APP}' {
  /** The URL pattern of each discovered Controller by its route name, in match order. */
  export interface Controllers {${entries((c) => JSON.stringify(c.pattern))}
  }
  /** The module of each discovered Controller by its route name. */
  export interface ControllerModules {${entries((c) => `typeof ${importType(dir, c.file)}`)}
  }
  /** Whether a discovered Controller's pattern matches \`pathname\`, so a dev server forwards it to \`start\`. */
  export const isControllerPath: (pathname: string) => boolean
}
`
}

/** The Layer Files section of the declaration: what each Layer File provides, by file, sorted. */
const layerFilesDeclaration = (files: readonly string[], root: string, dir: string) => {
  if (files.length === 0) return ''
  const entries = [...files]
    .sort()
    .map(
      (f) =>
        `\n    readonly ${JSON.stringify(normalizePath(path.relative(root, f)))}: import('effect').Layer.Layer.Success<typeof ${importType(dir, f)}.default>`,
    )
  return `declare module '${SERVER_APP}' {
  /** What each Layer File provides, by file. */
  export interface LayerFileServices {${entries.join('')}
  }
}
`
}

/**
 * Serves `virtual:sleek/server` (default export: `serverClients(...)`, a Layer providing every Server Service Tag over
 * the wire) and `virtual:sleek/server-registry` (default export: the entries for `start({ services })`), generated
 * from the contracts the analyzer reads in the Vite root's `tsconfig.json`. Both import each Tag and error class from
 * its contract file, never an implementation. An analyzer error fails the load naming file:line: no partial client.
 * Their types are kept in `serverDeclaration`, rewritten only when its text changes (and not created while there are
 * no contracts). In dev, a source change that
 * changes the generated code invalidates both modules in every environment and reloads the page; a `*.server.ts`
 * (implementation) change is ignored. The boundary: a server-only file (`SERVER_ONLY` of `@sleekstack/analyze`, with
 * `serverDir`) loaded in a client environment fails the build or the dev load, naming the import chain, unless the
 * chain starts at a test (type-only imports are erased before they get here). It also serves
 * `virtual:sleek/server-app`, the discovered app (`DiscoveredApp` of `@sleekstack/start`), and gives it to `start()`
 * in place of the stand-in `start` imports. Its Controllers are found by `discoverControllers` and read by the
 * analyzer's Controller pass; an error of either fails the module's load, and any build, naming the file. Each entry imports its
 * Controller and `_defaults.ts` modules eagerly (`start` loads the module on its first request) and carries the
 * printed Schemas of each method. With the file-routes plugin and routes under `routesDir`, the module also carries
 * the page router built from `virtual:sleekstack/routes`. Its named export `isControllerPath(pathname)` is what a dev
 * server forwards to `start`. The Controllers are declared in `serverDeclaration` (`Controllers`, each route name's
 * pattern, and `ControllerModules`, its module); a failing discovery, Controller pass or contract read leaves the whole
 * declaration as it was. In dev, a Controller or `_defaults.ts` added, removed or edited invalidates the module in
 * every environment and reloads the page. Each `*.rpc.ts` under `serverDir` (an RPC File, read by the analyzer's RPC
 * pass) is one Server Service: its Tag, `Context.GenericTag(<name>)`, is a named export of `virtual:sleek/rpc`, the
 * one Tag object every other module imports; its entry is in the browser Layer and the registry; and the discovered
 * app carries it as a service whose Layer is `serviceLayer` of `@sleekstack/start` over the file's methods and `wrap`.
 * The Manifest (`rpc.ts` under `serverDir`) is generated the same way, each service's methods the Controller Methods
 * its entries wrap, its Layer's `wrap` the Manifest's own (never the Controller directory's) and its options the default
 * export's. The declaration types each Tag by the file's methods (`GeneratedServiceShape`) and fills `GeneratedServices`. An
 * error of the pass fails every load naming file:line and leaves the declaration as it was; in dev, an RPC File added,
 * removed or edited regenerates and invalidates the modules like a contract or Controller does. The analyzer's Layer
 * File pass gives the discovered app its `layer` (the `*.layer.ts` files, tests excluded, composed by requirement) and
 * the Server Root's (`_app.ts` under `serverDir`) `onError`, and the declaration's `LayerFileServices`; they are
 * discovered, failed and invalidated as the Controllers are.
 */
export const serverServices = (options: ServerServicesOptions = {}): Plugin => {
  let project = ''
  let root = ''
  let serverDir = ''
  let controllersDir = ''
  let routesDir = ''
  let declarationFile = ''
  /** Whether `virtual:sleekstack/routes` is served: the file-routes plugin is in the config. */
  let routed = false
  let generated: Promise<Generated> | undefined
  let discovered: Promise<Discovered> | undefined
  let rpcs: Promise<Rpcs> | undefined
  const rpcRead = () =>
    (rpcs ??= readRpc(project, root, { serverDir, controllersDir, routesDir }).catch((cause: unknown) => ({
      error: cause instanceof Error ? cause.message : String(cause),
    })))
  const discover = async (): Promise<Discovered> => {
    try {
      const controllers = await discoverControllers({ serverDir, controllersDir, routesDir })
      const { methods, errors } = controllers.length
        ? await readControllers(project, serverDir, controllersDir)
        : { methods: new Map<string, ControllerMethods>(), errors: [] }
      if (errors.length) return { error: failed('Controllers', errors, root) }
      const r = await rpcRead()
      if ('error' in r) return r
      const layers = await readLayerFiles(project, root, serverDir)
      if ('error' in layers) return layers
      const pages = routed ? scan(routesDir) : undefined
      const found = pages?.found.length ? { notFound: !!pages.notFound } : undefined
      return {
        controllers,
        layerFiles: layers.files,
        code: appCode(controllers, methods, found, root, r.services, layers),
      }
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : String(cause) }
    }
  }
  const discovery = () => (discovered ??= discover())
  const generate = async (): Promise<Generated> => {
    try {
      const { contracts, errors } = await readContracts(project, serverDir)
      if (errors.length) return { error: failed('Server Service contracts', errors, root) }
      const r = await rpcRead()
      if ('error' in r) return r
      const entries = entriesCode([...contracts, ...r.services.map((s) => s.contract)], root)
      return {
        client: `${entries}export default serverClients(entries)\n`,
        registry: `${entries}export default entries\n`,
        rpc: r.code,
        declaration: declarationOf(contracts, r.services, root, normalizePath(path.dirname(declarationFile))),
        empty: contracts.length === 0 && r.services.length === 0,
      }
    } catch (cause) {
      return {
        error: `sleekstack: reading Server Service contracts crashed: ${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}`,
      }
    }
  }
  const current = () => (generated ??= generate())
  /** Build only: each module's first importer, per environment (Rolldown fills `importers` only at the end). */
  const parents = new WeakMap<Environment, Map<string, string>>()
  const parentsOf = (env: Environment) => parents.get(env) ?? parents.set(env, new Map()).get(env)!
  const importerOf = (env: Environment, id: string): string | undefined => {
    if (env.mode !== 'dev') return parentsOf(env).get(id)
    const importer = env.moduleGraph.getModuleById(id)?.importers.values().next().value
    return importer?.id ?? importer?.url
  }
  /** `id` and its importers up to an entry. */
  const chainOf = (env: Environment, id: string) => {
    const chain = [id]
    for (let at = importerOf(env, id); at && !chain.includes(at); at = importerOf(env, at)) chain.unshift(at)
    return chain
  }
  /** A file relative to the root; a virtual module as its id. */
  const rel = (id: string) => {
    const file = id.replace(/^\0/, '')
    return path.isAbsolute(file) ? normalizePath(path.relative(root, file)) : file
  }
  /** The one writer of the declaration: both sections, or none while either fails. */
  const writeDeclaration = (g: Generated, d: Discovered) => {
    if ('error' in g || 'error' in d) return
    const sources = [
      'the Server Service contracts',
      d.controllers.length && 'the Controllers',
      g.rpc && 'the RPC Files',
      d.layerFiles.length && 'the Layer Files',
    ]
    const dir = normalizePath(path.dirname(declarationFile))
    const text = `// Written by @sleekstack/ui-vite from ${new Intl.ListFormat('en').format(sources.filter((x): x is string => !!x))}; do not edit.
${g.declaration}${controllersDeclaration(d.controllers, dir)}${layerFilesDeclaration(d.layerFiles, root, dir)}`
    // An app with no contracts, RPC Files, Controllers or Layer Files gets no file.
    if (
      !fs.existsSync(declarationFile)
        ? g.empty && d.controllers.length === 0 && d.layerFiles.length === 0
        : fs.readFileSync(declarationFile, 'utf8') === text
    )
      return
    fs.mkdirSync(path.dirname(declarationFile), { recursive: true })
    fs.writeFileSync(declarationFile, text)
  }
  return {
    name: 'sleekstack:server-services',
    sharedDuringBuild: true,
    configResolved(config) {
      root = config.root
      project = path.join(root, 'tsconfig.json')
      serverDir = normalizePath(path.resolve(root, options.serverDir ?? 'server'))
      controllersDir = options.controllersDir
        ? normalizePath(path.resolve(root, options.controllersDir))
        : `${serverDir}/routes`
      routesDir = normalizePath(path.resolve(root, options.routesDir ?? 'src/routes'))
      declarationFile = path.resolve(root, options.serverDeclaration ?? 'src/server.gen.d.ts')
      routed = config.plugins.some((p) => p.name === 'sleekstack:routes')
      generated = discovered = rpcs = undefined
    },
    watchChange() {
      if (this.environment.mode === 'build') generated = discovered = rpcs = undefined
    },
    async buildStart() {
      const d = await discovery()
      writeDeclaration(await current(), d)
      // A build need not import the discovered app, whose load is what reports the error in dev.
      if (this.environment.mode === 'build' && 'error' in d) this.error(d.error)
    },
    resolveId: {
      // Before Vite's own resolver, which would find the stand-in's file.
      order: 'pre',
      filter: { id: new RegExp(`^(${VIRTUAL}|\\./discovered)$`) },
      handler: (id, importer) =>
        id !== STAND_IN ? `\0${id}` : importer && START_MODULE.test(importer) ? `\0${SERVER_APP}` : null,
    },
    moduleParsed(info) {
      const parents = parentsOf(this.environment)
      for (const child of [...info.importedIds, ...info.dynamicallyImportedIds])
        if (!parents.has(child)) parents.set(child, info.id)
    },
    load: {
      // Every source: the server-only list is the analyzer's, read at run time, so it cannot narrow the filter.
      filter: { id: [new RegExp(`^\0(${VIRTUAL})$`), SOURCE] },
      async handler(id) {
        if (id === `\0${SERVER_APP}`) {
          const d = await discovery()
          if ('error' in d) return this.error(d.error)
          return d.code
        }
        if (SOURCE.test(id)) {
          if (this.environment.config.consumer !== 'client') return null
          const { isServerOnly, TEST_FILE } = await analyzer()
          if (!isServerOnly(id, serverDir)) return null
          const chain = chainOf(this.environment, id).map(rel)
          if (!TEST_FILE.test(chain[0]!))
            this.error(
              `sleekstack: the server-only "${rel(id)}" is in the browser build: ${chain.join(' -> ')}. Import its contract instead, or use \`import type\`.`,
            )
          return null
        }
        const g = await current()
        if ('error' in g) return this.error(g.error)
        return id === `\0${CLIENT}` ? g.client : id === `\0${RPC}` ? g.rpc : g.registry
      },
    },
    configureServer(server) {
      /** A Layer File may sit anywhere in the TypeScript program, outside the Vite root too. */
      const watchLayerFiles = (d: Discovered) => {
        if (!('error' in d)) server.watcher.add(d.layerFiles.map((f) => path.dirname(f)))
      }
      // ponytail: re-reads every contract (a whole TypeScript program) per non-server source change; key the rerun on
      // the contracts' import graph if large projects stall.
      const changed = async (file: string) => {
        if (
          !SOURCE.test(file) ||
          IMPLEMENTATION.test(file) ||
          file.endsWith('.d.ts') ||
          file.includes('/node_modules/')
        )
          return
        const before = await Promise.all([current(), discovery()])
        // Both results carry every RPC File change: the Tags' names are in the client, their chains in the app.
        generated = discovered = rpcs = undefined
        const after = await Promise.all([current(), discovery()])
        writeDeclaration(...after)
        watchLayerFiles(after[1])
        const same = (i: 0 | 1) => JSON.stringify(before[i]) === JSON.stringify(after[i])
        // An edit leaves the discovery as it was, yet the app must load the edited Controller, RPC File, reserved file
        // or Layer File (anywhere but a test, as the analyzer reads them).
        const { TEST_FILE } = await analyzer()
        const discoveryFile =
          ([serverDir, controllersDir].some((dir) => file.startsWith(`${dir}/`)) &&
            (CONTROLLER.test(file) || RPC_FILE.test(file) || RESERVED.has(path.posix.basename(file)))) ||
          (LAYER_FILE.test(file) && !TEST_FILE.test(path.relative(root, file)))
        const ids = [...(same(0) ? [] : MODULES), ...(same(1) && !discoveryFile ? [] : [SERVER_APP])]
        if (ids.length === 0) return
        for (const env of Object.values(server.environments))
          for (const id of ids) {
            const mod = env.moduleGraph.getModuleById(`\0${id}`)
            if (mod) env.moduleGraph.invalidateModule(mod)
          }
        server.ws.send({ type: 'full-reload' })
      }
      const on = (file: string) => void changed(normalizePath(file))
      // A server or Controllers directory outside the Vite root is not watched by default.
      server.watcher.add([serverDir, controllersDir])
      void discovery().then(watchLayerFiles)
      server.watcher.on('add', on).on('change', on).on('unlink', on)
    },
  }
}
