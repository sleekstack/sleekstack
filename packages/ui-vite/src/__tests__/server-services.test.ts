import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { TaggedErrorSchema, TypeSchema } from '@sleekstack/analyze'
import { Schema } from 'effect'
import ts from 'typescript'
import { build, createServer, type InlineConfig, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sleekstack } from '../index.js'
import { printSchema, serverServices } from '../server-services.js'

const FIXTURE = path.join(import.meta.dirname, 'fixtures/server-services')
const START_CLIENT = path.resolve(import.meta.dirname, '../../../start/src/client.ts')
const CLIENT = 'virtual:sleek/server'
const REGISTRY = 'virtual:sleek/server-registry'

describe('the printed Schemas over the wire', () => {
  const str = { kind: 'string' } as const
  const num = { kind: 'number' } as const
  const none = { kind: 'undefined' } as const
  const alias = (_file: string, name: string) => name
  class Invalid extends Schema.TaggedError<Invalid>()('Invalid', {
    errors: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) }),
  }) {}
  // Each value goes through the Schema's encode, JSON text and decode, as a call does.
  const roundTrip = (description: TypeSchema | TaggedErrorSchema, value: unknown) => {
    const schema = new Function('Schema', 'Invalid', `return ${printSchema(description, alias)}`)(
      Schema,
      Invalid,
    ) as Schema.Schema<any, any>
    const text = JSON.stringify(Schema.encodeSync(schema)(value))
    return Schema.decodeUnknownSync(schema)(text === undefined ? undefined : JSON.parse(text))
  }

  it.each<[string, TypeSchema, unknown]>([
    ['string', str, 'a'],
    ['number', num, 1.5],
    ['boolean', { kind: 'boolean' }, false],
    ['null', { kind: 'null' }, null],
    ['literal', { kind: 'literal', value: 'a' }, 'a'],
    ['union', { kind: 'union', members: [str, num, { kind: 'null' }] }, null],
    ['readonly array', { kind: 'array', readonly: true, element: num }, [1, 2]],
    ['mutable array', { kind: 'array', readonly: false, element: str }, ['a']],
    [
      'object with an optional property left out',
      { kind: 'object', properties: [{ name: 'a', optional: true, type: str }] },
      {},
    ],
    [
      'object with a property that may be undefined and is',
      { kind: 'object', properties: [{ name: 'a', optional: false, type: { kind: 'union', members: [str, none] } }] },
      { a: undefined },
    ],
    [
      'nested objects in arrays',
      {
        kind: 'array',
        readonly: true,
        element: { kind: 'object', properties: [{ name: 'n', optional: false, type: num }] },
      },
      [{ n: 1 }],
    ],
    [
      'string-keyed record',
      { kind: 'record', readonly: true, value: { kind: 'array', readonly: true, element: str } },
      { a: ['x'], b: [] },
    ],
  ])('%s', (_, description, value) => expect(roundTrip(description, value)).toEqual(value))

  it('decodes a Schema.TaggedError back into its class', () => {
    const decoded = roundTrip(
      { kind: 'taggedError', name: 'Invalid', file: 'errors.ts', fields: [], schema: true },
      new Invalid({ errors: { email: ['is taken'] } }),
    )
    expect(decoded).toBeInstanceOf(Invalid)
    expect(decoded).toMatchObject({ _tag: 'Invalid', errors: { email: ['is taken'] } })
  })
})

describe('printSchema', () => {
  const str = { kind: 'string' } as const
  const alias = (file: string, name: string) => `${name}@${file}`
  it.each<[TypeSchema | TaggedErrorSchema, string]>([
    [str, 'Schema.String'],
    [{ kind: 'number' }, 'Schema.Number'],
    [{ kind: 'boolean' }, 'Schema.Boolean'],
    [{ kind: 'null' }, 'Schema.Null'],
    [{ kind: 'undefined' }, 'Schema.Undefined'],
    [{ kind: 'void' }, 'Schema.Void'],
    [{ kind: 'literal', value: 'a' }, 'Schema.Literal("a")'],
    [{ kind: 'literal', value: 1 }, 'Schema.Literal(1)'],
    [{ kind: 'literal', value: true }, 'Schema.Literal(true)'],
    [{ kind: 'union', members: [str, { kind: 'null' }] }, 'Schema.Union(Schema.String, Schema.Null)'],
    [{ kind: 'array', readonly: true, element: str }, 'Schema.Array(Schema.String)'],
    [{ kind: 'array', readonly: false, element: str }, 'Schema.mutable(Schema.Array(Schema.String))'],
    [{ kind: 'object', properties: [] }, 'Schema.Struct({})'],
    [
      {
        kind: 'object',
        properties: [
          { name: 'name', optional: false, type: str },
          { name: 'a-b', optional: true, type: { kind: 'object', properties: [] } },
        ],
      },
      'Schema.Struct({ "name": Schema.String, "a-b": Schema.optional(Schema.Struct({})) })',
    ],
    [
      {
        kind: 'object',
        properties: [
          { name: 'a', optional: false, type: { kind: 'undefined' } },
          { name: 'b', optional: false, type: { kind: 'union', members: [str, { kind: 'undefined' }] } },
        ],
      },
      'Schema.Struct({ "a": Schema.optional(Schema.Undefined), "b": Schema.optional(Schema.Union(Schema.String, Schema.Undefined)) })',
    ],
    [
      { kind: 'taggedError', name: 'Missing', file: 'src/errors.ts', fields: [] },
      'taggedError(Missing@src/errors.ts, {})',
    ],
    [
      { kind: 'taggedError', name: 'NameTaken', file: 'a.ts', fields: [{ name: 'name', optional: false, type: str }] },
      'taggedError(NameTaken@a.ts, { "name": Schema.String })',
    ],
    [{ kind: 'taggedError', name: 'Invalid', file: 'e.ts', fields: [], schema: true }, 'Invalid@e.ts'],
    [{ kind: 'record', readonly: true, value: str }, 'Schema.Record({ key: Schema.String, value: Schema.String })'],
    [
      { kind: 'record', readonly: false, value: str },
      'Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.String }))',
    ],
  ])('%j prints %s', (description, expected) => expect(printSchema(description, alias)).toBe(expected))
})

let server: ViteDevServer | undefined
let base = ''
afterEach(async () => {
  await server?.close()
  server = undefined
  fs.rmSync(base, { recursive: true, force: true })
})

/** A copy of the fixture in `src`, plus `extra` files, with a tsconfig the analyzer reads. */
const scaffold = (extra: Record<string, string> = {}) => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ui-vite-server-services-')))
  fs.symlinkSync(path.resolve(import.meta.dirname, '../../node_modules'), path.join(base, 'node_modules'))
  const root = path.join(base, 'app')
  const src = path.join(root, 'src')
  fs.cpSync(FIXTURE, src, { recursive: true })
  for (const [file, text] of Object.entries(extra)) fs.writeFileSync(path.join(src, file), text)
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        skipLibCheck: true,
        noEmit: true,
        paths: { '@sleekstack/start/client': [START_CLIENT] },
      },
      include: ['src'],
    }),
  )
  return { root, src }
}
/** `@sleekstack/start/client` is its source, so the generated code runs. */
const config = (root: string): InlineConfig => ({
  root,
  configFile: false,
  logLevel: 'silent',
  plugins: [serverServices()],
  resolve: { alias: { '@sleekstack/start/client': START_CLIENT } },
})

/** A dev server (no file watching: tests emit watcher events) over `scaffold(extra)`. */
const serve = async (extra: Record<string, string> = {}) => {
  const { root, src } = scaffold(extra)
  server = await createServer({
    ...config(root),
    // The client environment's dependency optimizer would hold `close` for its run.
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, watch: null },
  })
  await server.pluginContainer.buildStart({})
  const load = async (id: string) => {
    const code = (await server!.pluginContainer.load(`\0${id}`)) as string
    return code.replaceAll(root, '<root>')
  }
  return { server, root, src, load, declaration: path.join(src, 'server.gen.d.ts') }
}

describe('serverServices()', () => {
  it('generates the browser Layer and the registry from the contracts', async () => {
    const { server, src, load } = await serve()
    const client = await load(CLIENT)
    expect(client).toMatchInlineSnapshot(`
      "import { Schema } from 'effect'
      import { serverClients, taggedError } from '@sleekstack/start/client'
      import { Profiles as Profiles_0 } from "<root>/src/contract.ts"
      import { NameTaken as NameTaken_1 } from "<root>/src/contract.ts"
      import { Missing as Missing_2 } from "<root>/src/errors.ts"
      const entries = [
        { tag: Profiles_0, methods: { "rename": { input: Schema.Struct({ "name": Schema.String }), success: Schema.Struct({ "name": Schema.String, "tags": Schema.Array(Schema.String) }), error: Schema.Union(taggedError(NameTaken_1, { "name": Schema.String }), taggedError(Missing_2, {})) }, "count": { input: Schema.Void, success: Schema.Number } } },
      ]
      export default serverClients(entries)
      "
    `)
    expect(client).not.toMatch(/\.server\./)
    const registry = await load(REGISTRY)
    expect(registry).toBe(client.replace('export default serverClients(entries)', 'export default entries'))

    // The code runs: the Layer is a Layer, the registry's Schemas decode into the contract's classes.
    const { Layer, Schema } = await server.ssrLoadModule('effect')
    expect(Layer.isLayer((await server.ssrLoadModule(CLIENT)).default)).toBe(true)
    const [entry] = (await server.ssrLoadModule(REGISTRY)).default
    const contract = await server.ssrLoadModule(path.join(src, 'contract.ts'))
    const { Missing } = await server.ssrLoadModule(path.join(src, 'errors.ts'))
    expect(entry.tag).toBe(contract.Profiles)
    expect(Schema.decodeUnknownSync(entry.methods.rename.error)({ _tag: 'Missing' })).toBeInstanceOf(Missing)
    expect(Schema.decodeUnknownSync(entry.methods.rename.error)({ _tag: 'NameTaken', name: 'a' })).toBeInstanceOf(
      contract.NameTaken,
    )
    expect(() => Schema.decodeUnknownSync(entry.methods.rename.input)({ name: 1 })).toThrow()
  })

  it('types both modules in the declaration', async () => {
    const { root, src, declaration } = await serve()
    expect(fs.readFileSync(declaration, 'utf8')).toContain('Layer.Layer<import("./contract").Profiles>')
    const consumer = path.join(src, 'consumer.ts')
    fs.writeFileSync(
      consumer,
      `import type { ServerServiceEntry } from '@sleekstack/start/client'
import type { Layer } from 'effect'
import layer from '${CLIENT}'
import services from '${REGISTRY}'
import type { Profiles } from './contract'
export const l: Layer.Layer<Profiles> = layer
export const s: ReadonlyArray<ServerServiceEntry<Profiles>> = services
// @ts-expect-error the Layer is typed, not any
export const n: number = layer
`,
    )
    const { config } = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root)
    const program = ts.createProgram(parsed.fileNames, parsed.options)
    expect(ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual(
      [],
    )
  })

  it('fails the load with file:line on an analyzer error, emitting no client', async () => {
    const { load } = await serve({
      'dated.ts': `import { ServerService } from '@sleekstack/start/client'
import type { Effect } from 'effect'

export class Dated extends ServerService('Dated')<Dated, { readonly at: () => Effect.Effect<Date> }>() {}
`,
    })
    for (const id of [CLIENT, REGISTRY])
      await expect(load(id)).rejects.toThrow(/dated\.ts:4 ServerServiceTypeNotSerializable/)
  })

  it('invalidates both modules in every environment on a contract change only; rewrites the declaration on a text change', async () => {
    const { server, src, load, declaration } = await serve()
    for (const env of Object.values(server.environments))
      for (const id of [CLIENT, REGISTRY]) await env.transformRequest(id)
    const spies = Object.values(server.environments).map((env) => vi.spyOn(env.moduleGraph, 'invalidateModule'))
    // Vite also invalidates an edited file's importers, passing its own propagation arguments; the plugin passes the module only.
    const invalidated = () =>
      spies.map((spy) => spy.mock.calls.filter((args) => args.length === 1).map(([mod]) => mod.id))
    const reload = vi.spyOn(server.ws, 'send')
    const old = new Date(2000, 0, 1)
    fs.utimesSync(declaration, old, old)
    /** Edits `file` and lets the plugin's rerun finish (the next load waits on it). */
    const edit = async (file: string, text: (t: string) => string) => {
      const full = path.join(src, file)
      fs.writeFileSync(full, text(fs.readFileSync(full, 'utf8')))
      server.watcher.emit('change', full)
      await new Promise((r) => setTimeout(r, 0))
      await load(CLIENT)
    }

    await edit('profiles.server.ts', (t) =>
      t.replace('count: () => Effect.succeed(0)', 'count: () => Effect.succeed(1)'),
    )
    await edit('contract.ts', (t) => `// a comment\n${t}`)
    expect(reload).not.toHaveBeenCalled()
    expect(invalidated().flat()).toEqual([])
    expect(fs.statSync(declaration).mtime).toEqual(old)

    await edit(
      'contract.ts',
      (t) =>
        `${t}\nexport class Items extends ServerService('Items')<Items, { readonly list: () => Effect.Effect<readonly string[]> }>() {}\n`,
    )
    expect(reload).toHaveBeenCalledWith({ type: 'full-reload' })
    for (const ids of invalidated()) expect(ids).toEqual([`\0${CLIENT}`, `\0${REGISTRY}`])
    expect(invalidated()).toHaveLength(Object.keys(server.environments).length)
    expect(fs.readFileSync(declaration, 'utf8')).toContain('import("./contract").Items')
  })

  it('is in the sleekstack() plugins and exported on its own', () => {
    expect(sleekstack().map((p) => p.name)).toContain('sleekstack:server-services')
    expect(serverServices().name).toBe('sleekstack:server-services')
  })
})

describe('server boundary', () => {
  /** A browser entry reaching `page.ts`, which imports from the implementation as `page`. */
  const app = (page: string) => {
    const { root } = scaffold({
      'main.ts': `import layer from '${CLIENT}'\nimport { page } from './page'\nconsole.log(layer, page)\n`,
      'page.ts': page,
    })
    fs.writeFileSync(path.join(root, 'index.html'), '<script type="module" src="/src/main.ts"></script>')
    return root
  }
  const client = (root: string) => build({ ...config(root), build: { write: false } })
  const ssr = (root: string) => build({ ...config(root), build: { write: false, ssr: 'src/main.ts' } })

  it('fails the client build naming the import chain; the SSR build of the same app succeeds', async () => {
    const root = app(`import { ProfilesLive } from './profiles.server'\nexport const page = ProfilesLive\n`)
    await expect(client(root)).rejects.toThrow(
      'the server-only "src/profiles.server.ts" is in the browser build: index.html -> src/main.ts -> src/page.ts -> src/profiles.server.ts',
    )
    await expect(ssr(root)).resolves.toBeDefined()
  })

  it('lets a type-only import of a server file through', async () => {
    const root = app(
      `import type { ProfilesLive } from './profiles.server'\nexport const page: typeof ProfilesLive | 1 = 1\n`,
    )
    await expect(client(root)).resolves.toBeDefined()
  })

  it('fails the dev client load naming the import chain', async () => {
    const { server } = await serve({
      'main.ts': `import { page } from './page'\nconsole.log(page)\n`,
      'page.ts': `import { ProfilesLive } from './profiles.server'\nexport const page = ProfilesLive\n`,
    })
    const env = server.environments.client
    await env.transformRequest('/src/main.ts')
    await env.transformRequest('/src/page.ts')
    await expect(env.transformRequest('/src/profiles.server.ts')).rejects.toThrow(
      'src/main.ts -> src/page.ts -> src/profiles.server.ts',
    )
    await expect(server.environments.ssr.transformRequest('/src/profiles.server.ts')).resolves.toBeTruthy()
  })

  it('lets a test import a server file in the client environment (vitest runs jsdom tests there)', async () => {
    const { server } = await serve({
      'page.test.ts': `import { ProfilesLive } from './profiles.server'\nconsole.log(ProfilesLive)\n`,
    })
    const env = server.environments.client
    await env.transformRequest('/src/page.test.ts')
    await expect(env.transformRequest('/src/profiles.server.ts')).resolves.toBeTruthy()
  })
})
