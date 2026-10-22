import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import { createServer as listen } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { TaggedErrorSchema, TypeSchema } from '@sleekstack/analyze'
import { Either, Schema } from 'effect'
import ts from 'typescript'
import { build, createServer, type InlineConfig, type Plugin, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { devMiddleware, sleekstack } from '../index.js'
import { routes } from '../routes.js'
import { discoverControllers, printSchema, serverServices, type ServerServicesOptions } from '../server-services.js'

const FIXTURE = path.join(import.meta.dirname, 'fixtures/server-services')
const START_CLIENT = path.resolve(import.meta.dirname, '../../../start/src/client.ts')
const CLIENT = 'virtual:sleek/server'
const REGISTRY = 'virtual:sleek/server-registry'
const SERVER_APP = 'virtual:sleek/server-app'
/** A server entry calling `start()` with no options, and a test of it for a nested vitest run. */
const APP_FIXTURE = path.join(import.meta.dirname, 'fixtures/server-app')
/** A fixture of app files (not its committed declaration) as `scaffold` extras: its directories beside `src`. */
const appFiles = (fixture: string) => {
  const dir = path.join(import.meta.dirname, 'fixtures', fixture)
  return Object.fromEntries(
    fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => fs.statSync(path.join(dir, f)).isFile() && !f.endsWith('.gen.d.ts'))
      .map((f) => [`../${f}`, fs.readFileSync(path.join(dir, f), 'utf8')]),
  )
}
const controllerFiles = appFiles('controllers')
/** One Controller with a referenced Schema, string codecs and an option chain (`_defaults.ts` maps decode failures to 422). */
const CONTROLLER_APP = path.join(import.meta.dirname, 'fixtures/controller-app')
const controllerApp = appFiles('controller-app')

describe('the printed Schemas over the wire', () => {
  const str = { kind: 'string' } as const
  const num = { kind: 'number' } as const
  const none = { kind: 'undefined' } as const
  const alias = (_file: string, name: string) => name
  class Invalid extends Schema.TaggedError<Invalid>()('Invalid', {
    errors: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) }),
  }) {}
  const schemaOf = (description: TypeSchema | TaggedErrorSchema) =>
    new Function('Schema', 'Invalid', `return ${printSchema(description, alias)}`)(Schema, Invalid) as Schema.Schema<
      any,
      any
    >
  // Each value goes through the Schema's encode, JSON text and decode, as a call does.
  const roundTrip = (description: TypeSchema | TaggedErrorSchema, value: unknown) => {
    const schema = schemaOf(description)
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

  it.each<[string, TypeSchema, ReadonlyArray<readonly [string, unknown]>, readonly string[]]>([
    [
      'number',
      { kind: 'number', codec: 'string' },
      [
        ['0', 0],
        ['-2', -2],
        ['1.5', 1.5],
      ],
      ['', ' 1', '1e3', '0x10', 'NaN', 'Infinity', '.5', '1.', '+1', '1'.repeat(400)],
    ],
    [
      'boolean',
      { kind: 'boolean', codec: 'string' },
      [
        ['true', true],
        ['false', false],
      ],
      ['', 'TRUE', '1', 'yes'],
    ],
  ])(
    'the %s string codec reads a path or query value from its text, and nothing else',
    (_, description, read, refused) => {
      const decode = Schema.decodeUnknownEither(schemaOf(description))
      expect(read.map(([text]) => Either.getOrThrow(decode(text)))).toEqual(read.map(([, value]) => value))
      expect(refused.filter((text) => Either.isRight(decode(text)))).toEqual([])
    },
  )

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
    [{ kind: 'ref', file: 'schemas.ts', name: 'User' }, 'User@schemas.ts'],
    [
      { kind: 'number', codec: 'string' },
      'Schema.transform(Schema.String.pipe(Schema.pattern(/^-?\\d+(\\.\\d+)?$/)), Schema.Finite, { strict: true, decode: Number, encode: String })',
    ],
    [{ kind: 'boolean', codec: 'string' }, 'Schema.BooleanFromString'],
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

/** A copy of the fixture in `src`, plus `extra` files (relative to `src`), with a tsconfig the analyzer reads. */
const scaffold = (extra: Record<string, string> = {}) => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ui-vite-server-services-')))
  fs.symlinkSync(path.resolve(import.meta.dirname, '../../node_modules'), path.join(base, 'node_modules'))
  const root = path.join(base, 'app')
  const src = path.join(root, 'src')
  fs.cpSync(FIXTURE, src, { recursive: true })
  for (const [file, text] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(src, file)), { recursive: true })
    fs.writeFileSync(path.join(src, file), text)
  }
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
      // The analyzer reads the Controllers under `server` and `api` (the `controllersDir` test).
      include: ['src', 'server', 'api'],
    }),
  )
  return { root, src }
}
/** The type errors of the scaffold's TypeScript program. */
const typeErrors = (root: string) => {
  const { config } = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  return ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}
/** `@sleekstack/start/client` is its source, so the generated code runs. */
const config = (root: string, options?: ServerServicesOptions): InlineConfig => ({
  root,
  configFile: false,
  logLevel: 'silent',
  plugins: [serverServices(options)],
  resolve: { alias: { '@sleekstack/start/client': START_CLIENT } },
})

/** A dev server (no file watching: tests emit watcher events) over `scaffold(extra)`. */
const serve = async (extra: Record<string, string> = {}, plugins: Plugin[] = [serverServices()]) => {
  const { root, src } = scaffold(extra)
  server = await createServer({
    ...config(root),
    plugins,
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
    expect(typeErrors(root)).toEqual([])
  })

  it('imports a referenced Schema from its module and decodes through it', async () => {
    const { server, load } = await serve({
      'names.ts': `import { Schema } from 'effect'\nexport const Name = Schema.NonEmptyString\n`,
      'named.ts': `import { ServerService } from '@sleekstack/start/client'
import type { Effect, Schema } from 'effect'
import type { Name } from './names'

export class Named extends ServerService('Named')<Named, { readonly set: (input: Schema.Schema.Type<typeof Name>) => Effect.Effect<void> }>() {}
`,
    })
    expect(await load(REGISTRY)).toMatch(
      /import \{ Name as (Name_\d+) \} from "<root>\/src\/names\.ts"\n[^]*"set": \{ input: \1, success: Schema\.Void \}/,
    )
    const { Schema } = await server.ssrLoadModule('effect')
    const entries: ReadonlyArray<{ methods: Record<string, { input: unknown }> }> = (
      await server.ssrLoadModule(REGISTRY)
    ).default
    const set = entries.find((e) => 'set' in e.methods)!.methods.set!.input
    expect(Schema.decodeUnknownSync(set)('a')).toBe('a')
    expect(() => Schema.decodeUnknownSync(set)('')).toThrow()
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
  const app = (page: string, extra: Record<string, string> = {}) => {
    const { root } = scaffold({
      'main.ts': `import layer from '${CLIENT}'\nimport { page } from './page'\nconsole.log(layer, page)\n`,
      'page.ts': page,
      ...extra,
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

  it('fails the client build on a Controller reachable from a browser entry', async () => {
    const root = app(`import { users } from './users.controller'\nexport const page = users\n`, {
      'users.controller.ts': 'export const users = 1\n',
    })
    await expect(client(root)).rejects.toThrow(
      'the server-only "src/users.controller.ts" is in the browser build: index.html -> src/main.ts -> src/page.ts -> src/users.controller.ts',
    )
  })

  it.each([
    [undefined, 'server', 'lib'],
    ['lib', 'lib', 'server'],
  ] as const)(
    'with serverDir %s, fails the dev client load of %s/_defaults.ts and not of %s/_defaults.ts',
    async (serverDir, inside, outside) => {
      const { server } = await serve(
        {
          [`../${inside}/routes/_defaults.ts`]: 'export const a = 1\n',
          [`../${outside}/_defaults.ts`]: 'export const b = 1\n',
        },
        [serverServices({ serverDir })],
      )
      const env = server.environments.client
      await expect(env.transformRequest(`/${inside}/routes/_defaults.ts`)).rejects.toThrow(
        `the server-only "${inside}/routes/_defaults.ts" is in the browser build`,
      )
      await expect(env.transformRequest(`/${outside}/_defaults.ts`)).resolves.toBeTruthy()
    },
  )

  describe('sleekstack({ serverDir: "lib" }), its analyzer included', () => {
    const reaching = (dir: string) => {
      const root = app(`import { a } from '../${dir}/_defaults'\nexport const page = a\n`, {
        [`../${dir}/_defaults.ts`]: 'export const a = 1\n',
      })
      return build({ ...config(root), plugins: sleekstack({ serverDir: 'lib' }), build: { write: false } })
    }

    it('builds a client reaching server/_defaults.ts', () => expect(reaching('server')).resolves.toBeDefined())

    it('fails a client build reaching lib/_defaults.ts with ServerFileInClientGraph', () =>
      expect(reaching('lib')).rejects.toThrow('ServerFileInClientGraph: The server-only "lib/_defaults.ts"'))
  })

  it('lets a test-only file under test/ import a server file in the client environment', async () => {
    const { server } = await serve({
      '../test/helpers.ts': `import { ProfilesLive } from '../src/profiles.server'\nconsole.log(ProfilesLive)\n`,
    })
    const env = server.environments.client
    await env.transformRequest('/test/helpers.ts')
    await expect(env.transformRequest('/src/profiles.server.ts')).resolves.toBeTruthy()
  })
})

// `@sleekstack/start` is the workspace link here (its built dist), as in an app of this repo.
describe('the discovered app', () => {
  const serverApp = Object.fromEntries(
    fs.readdirSync(APP_FIXTURE).map((file) => [file, fs.readFileSync(path.join(APP_FIXTURE, file), 'utf8')]),
  )
  const status = async (app: { fetch: (request: Request) => Promise<Response> }) =>
    (await app.fetch(new Request('http://x.test/'))).status

  it('reaches start() through ssrLoadModule: no router and no Controllers, so a page is 404', async () => {
    const { server, src } = await serve(serverApp)
    expect(await status((await server.ssrLoadModule(path.join(src, 'server.ts'))).app)).toBe(404)
  })

  it('reaches start() in a vitest run', () => {
    const { root } = scaffold(serverApp)
    const plugin = JSON.stringify(path.resolve(import.meta.dirname, '../server-services.ts'))
    fs.writeFileSync(
      path.join(root, 'vitest.config.ts'),
      `import { serverServices } from ${plugin}\nexport default { plugins: [serverServices()], test: { include: ['src/*.vitest.ts'] } }\n`,
    )
    const vitest = path.resolve(import.meta.dirname, '../../node_modules/vitest/vitest.mjs')
    const run = spawnSync(process.execPath, [vitest, 'run', '--root', root], { encoding: 'utf8' })
    expect(run.status, run.stdout + run.stderr).toBe(0)
    expect(run.stdout).toContain('1 passed')
  })

  const built = async (root: string) => {
    await build({ ...config(root), build: { ssr: 'src/server.ts' } })
    return (await import(pathToFileURL(path.join(root, 'dist/server.mjs')).href)).app
  }

  it('reaches start() from a vite build --ssr', async () => {
    expect(await status(await built(scaffold(serverApp).root))).toBe(404)
  })

  it('is typed by @sleekstack/start for a consumer', () => {
    const { root } = scaffold({
      ...serverApp,
      'consumer.ts': `import type { DiscoveredApp } from '@sleekstack/start'
import app from '${SERVER_APP}'
export const a: DiscoveredApp = app
// @ts-expect-error the app is typed, not any
export const n: number = app
`,
    })
    expect(typeErrors(root)).toEqual([])
  })

  const json = (body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('serves a generated entry through start(): a referenced Schema, string codecs and the option chain', async () => {
    const { server, src, load } = await serve({ ...serverApp, ...controllerApp })
    const { app } = await server.ssrLoadModule(path.join(src, 'server.ts'))
    const call = async (url: string, init?: RequestInit) => {
      const response: Response = await app.fetch(new Request(`http://x.test${url}`, init))
      return [response.status, await response.text()]
    }
    // Decoded through the number and boolean codecs; encoded through the success Schema, which drops `hidden`.
    expect(await call('/users/7?tags=a&tags=b&full=true')).toEqual([200, '{"id":7,"tags":["a","b"],"full":true}'])
    // A failed decode reaches the wrap of server/_defaults.ts.
    expect(await call('/users/7.5e1')).toEqual([422, ''])
    expect(await call('/users/7?full=yes')).toEqual([422, ''])
    expect(await call('/users/7', json({ name: 'Ann' }))).toEqual([200, '{"id":7,"name":"Ann"}'])
    // The referenced `Name` is `Schema.NonEmptyString`.
    expect(await call('/users/7', json({ name: '' }))).toEqual([422, ''])
    // The Controller's own bodyLimit (32): BodyTooLarge passes the wrap.
    expect(await call('/users/7', json({ name: 'a'.repeat(32) }))).toEqual([413, ''])
    // The module the entry came from.
    expect(await load(SERVER_APP)).toMatchInlineSnapshot(`
      "import { Schema } from 'effect'
      import { bind, segments } from '@sleekstack/router'
      import * as $0 from "<root>/server/_defaults.ts"
      import * as $1 from "<root>/server/routes/users/[id].controller.ts"
      import { Name as Name_2 } from "<root>/src/schemas.ts"
      const options = (file, m) => ({ file, wrap: m.wrap, bodyLimit: m.bodyLimit, origins: m.origins })
      const controllers = [
        { route: "users/[id]", pattern: "/users/:id", methods: { GET: { run: $1.GET, params: Schema.Struct({ "id": Schema.transform(Schema.String.pipe(Schema.pattern(/^-?\\d+(\\.\\d+)?$/)), Schema.Finite, { strict: true, decode: Number, encode: String }) }), query: Schema.Struct({ "tags": Schema.optional(Schema.Union(Schema.Undefined, Schema.Array(Schema.String))), "full": Schema.optional(Schema.Union(Schema.Undefined, Schema.BooleanFromString)) }), success: Schema.Struct({ "id": Schema.Number, "tags": Schema.Array(Schema.String), "full": Schema.Boolean }) }, PUT: { run: $1.PUT, params: Schema.Struct({ "id": Schema.transform(Schema.String.pipe(Schema.pattern(/^-?\\d+(\\.\\d+)?$/)), Schema.Finite, { strict: true, decode: Number, encode: String }) }), body: Schema.Struct({ "name": Name_2 }) } }, options: [options("server/_defaults.ts", $0), options("server/routes/users/[id].controller.ts", $1)] },
      ]
      export default {
        controllers,
      }
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
      "
    `)
  })

  it('writes the committed declaration of the fixture, which types a consumer', async () => {
    const { root, src, declaration } = await serve({ ...serverApp, ...controllerApp })
    expect(fs.readFileSync(declaration, 'utf8')).toBe(
      fs.readFileSync(path.join(CONTROLLER_APP, 'src/server.gen.d.ts'), 'utf8'),
    )
    fs.writeFileSync(
      path.join(src, 'consumer.ts'),
      `import { type ControllerModules, type Controllers, isControllerPath } from '${SERVER_APP}'
export const pattern: Controllers['users/[id]'] = '/users/:id'
type Put = Parameters<ControllerModules['users/[id]']['PUT']>[0]
export const put: Put = { params: { id: 1 }, body: { name: 'a' } }
// @ts-expect-error the id is a number
export const text: Put = { params: { id: '1' }, body: { name: 'a' } }
export const forwards: boolean = isControllerPath('/users/1')
// @ts-expect-error the Controller exports no POST
export type Post = ControllerModules['users/[id]']['POST']
`,
    )
    expect(typeErrors(root)).toEqual([])
  })

  it('carries the page router built from the file routes, which start() serves unless given its own', async () => {
    const page = (text: string) =>
      `import { jsx } from '@sleekstack/ui/jsx-runtime'\nexport default () => jsx('p', { children: ${JSON.stringify(text)} })\n`
    const { server, src } = await serve(
      {
        ...serverApp,
        'routes/index.ts': page('discovered'),
        'explicit.ts': `import { router } from '@sleekstack/router'
import { start } from '@sleekstack/start'
import { jsx } from '@sleekstack/ui/jsx-runtime'
const render = () => jsx('p', { children: 'explicit' })
export const app = start({ router: router({ table: { home: '/' }, pages: { home: { render } }, notFound: render }) })
`,
      },
      [routes(), serverServices()],
    )
    const html = async (file: string) => {
      const { app } = await server.ssrLoadModule(path.join(src, file))
      return (await app.fetch(new Request('http://x.test/'))).text()
    }
    expect(await html('server.ts')).toContain('>discovered<')
    expect(await html('explicit.ts')).toContain('>explicit<')
  })

  it('resolves the module in a vite build --ssr, and fails a client build reaching a Controller through it', async () => {
    const { root } = scaffold({
      ...serverApp,
      ...controllerApp,
      'main.ts': `import app from '${SERVER_APP}'\nconsole.log(app)\n`,
    })
    fs.writeFileSync(path.join(root, 'index.html'), '<script type="module" src="/src/main.ts"></script>')
    await expect(build({ ...config(root), build: { write: false } })).rejects.toThrow(
      /the server-only "server\/.+" is in the browser build: index\.html -> src\/main\.ts -> virtual:sleek\/server-app -> server\//,
    )
    const app = await built(root)
    expect(await (await app.fetch(new Request('http://x.test/users/7'))).text()).toBe('{"id":7,"tags":[],"full":false}')
  })

  it('forwards Controller paths to start() in dev, and leaves asset and module requests to Vite', async () => {
    const { server, src } = await serve({ ...serverApp, ...controllerFiles })
    const accepts = async (pathname: string): Promise<boolean> =>
      (await server.ssrLoadModule(SERVER_APP)).isControllerPath(pathname)
    const forwarded = ['/', '/files/a/b', '/posts', '/posts/2', '/stats', '/users/', '/users/new', '/users/%E2%9C%93']
    const kept = [
      '/src/contract.ts',
      '/@vite/client',
      '/@fs/x.ts',
      '/node_modules/.vite/deps/effect.js',
      '/favicon.ico',
    ]
    expect(await Promise.all([...forwarded, ...kept, '/files', '/users/1/edit'].map(accepts))).toEqual([
      ...forwarded.map(() => true),
      ...kept.map(() => false),
      false,
      false,
    ])

    const middleware = devMiddleware(async () => (await server.ssrLoadModule(path.join(src, 'server.ts'))).app, accepts)
    const http = listen((req, res) => middleware(req, res, () => server.middlewares(req, res)))
    await new Promise<void>((r) => http.listen(0, r))
    try {
      const url = `http://localhost:${(http.address() as AddressInfo).port}`
      expect(await (await fetch(`${url}/users/1`)).text()).toBe('"user"')
      const module = await fetch(`${url}/src/contract.ts`)
      expect([module.status, module.headers.get('content-type')]).toEqual([200, 'text/javascript'])
    } finally {
      http.close()
    }
  })
})

describe('Controller discovery', () => {
  const dirsOf = (root: string) => ({
    serverDir: `${root}/server`,
    controllersDir: `${root}/server/routes`,
    routesDir: `${root}/src/routes`,
  })

  it('names each Controller by its path, in match order, with its _defaults.ts files outer first', async () => {
    const { root } = scaffold(controllerFiles)
    const found = await discoverControllers(dirsOf(root))
    expect(found.map((c) => [c.route, c.pattern, c.defaults.map((d) => path.relative(root, d))])).toEqual([
      ['index', '/', ['server/_defaults.ts']],
      ['files/[...path]', '/files/*path', ['server/_defaults.ts']],
      ['posts/[[page]]', '/posts/:page?', ['server/_defaults.ts']],
      ['(admin)/stats', '/stats', ['server/_defaults.ts']],
      ['users/index', '/users', ['server/_defaults.ts', 'server/routes/users/_defaults.ts']],
      ['users/new', '/users/new', ['server/_defaults.ts', 'server/routes/users/_defaults.ts']],
      ['users/[id]', '/users/:id', ['server/_defaults.ts', 'server/routes/users/_defaults.ts']],
    ])
    for (const c of found) expect(c.file).toBe(`${root}/server/routes/${c.route}.controller.ts`)
  })

  it.each<[string, Record<string, string>, (root: string) => readonly string[]]>([
    [
      'an orphan Controller',
      { '../server/users.controller.ts': '' },
      (r) => [`invalid Controller file ${r}/server/users.controller.ts: it is outside the Controllers directory`],
    ],
    [
      'a splat that is not last',
      { '../server/routes/[...rest]/x.controller.ts': '' },
      (r) => [
        `invalid Controller file ${r}/server/routes/[...rest]/x.controller.ts: an optional or splat segment must be the last one`,
      ],
    ],
    [
      'a URL under /_sleek/',
      { '../server/routes/(api)/_sleek/fn.controller.ts': '' },
      (r) => [
        `invalid Controller file ${r}/server/routes/(api)/_sleek/fn.controller.ts: its URL would start with /_sleek/`,
      ],
    ],
    [
      'two Controllers whose paths differ only in param names',
      { '../server/routes/users/[id].controller.ts': '', '../server/routes/users/[name].controller.ts': '' },
      (r) => [
        'Controller files ',
        `${r}/server/routes/users/[id].controller.ts`,
        `${r}/server/routes/users/[name].controller.ts`,
        'both give path /users/:',
      ],
    ],
    [
      'a Controller and a page route at one path',
      { '../server/routes/(site)/about/[x].controller.ts': '', 'routes/about/[slug].tsx': 'export default 1\n' },
      (r) => [
        `Controller file ${r}/server/routes/(site)/about/[x].controller.ts and route file ${r}/src/routes/about/[slug].tsx both give path /about/:x`,
      ],
    ],
  ])('fails naming the file(s) for %s', async (_, extra, parts) => {
    const { root } = scaffold(extra)
    const error = await discoverControllers(dirsOf(root)).then(
      () => undefined,
      (e: Error) => e.message,
    )
    for (const part of parts(root)) expect(error).toContain(part)
  })

  it('declares each route name with its pattern beside the Server Services, for a TypeScript consumer', async () => {
    const { root, src, declaration } = await serve(controllerFiles)
    const text = fs.readFileSync(declaration, 'utf8')
    expect(text).toContain('Layer.Layer<import("./contract").Profiles>')
    expect(text).toContain(`declare module '${SERVER_APP}' {`)
    fs.writeFileSync(
      path.join(src, 'consumer.ts'),
      `import type { DiscoveredApp } from '@sleekstack/start'
import app, { type Controllers } from '${SERVER_APP}'
export const a: DiscoveredApp = app
export const id: Controllers['users/[id]'] = '/users/:id'
export const names: ReadonlyArray<keyof Controllers> = ['index', '(admin)/stats', 'files/[...path]']
// @ts-expect-error a route name no Controller has
export const none: Controllers['users/[name]'] = '/users/:name'
// @ts-expect-error the pattern is a literal
export const other: Controllers['users/[id]'] = '/users/1'
`,
    )
    expect(typeErrors(root)).toEqual([])
  })

  it('invalidates the discovered app in every environment on a Controller or _defaults.ts added, removed, renamed or edited', async () => {
    const { server, root, load, declaration } = await serve(controllerFiles)
    for (const env of Object.values(server.environments)) await env.transformRequest(SERVER_APP)
    const spies = Object.values(server.environments).map((env) => vi.spyOn(env.moduleGraph, 'invalidateModule'))
    const reload = vi.spyOn(server.ws, 'send')
    /** Applies one file event and lets the plugin's rerun finish (the load waits on it). */
    const event = async (kind: 'add' | 'change' | 'unlink', file: string) => {
      const full = path.join(root, file)
      if (kind === 'unlink') fs.rmSync(full)
      else {
        fs.mkdirSync(path.dirname(full), { recursive: true })
        fs.writeFileSync(full, `export const at = ${Date.now()}\n`)
      }
      server.watcher.emit(kind, full)
      await new Promise((r) => setTimeout(r, 0))
      await load(SERVER_APP)
      await new Promise((r) => setTimeout(r, 0))
      // Vite also invalidates an edited file's importers, passing its own propagation arguments; the plugin passes the module only.
      const invalidated = spies.map((spy) => spy.mock.calls.filter((args) => args.length === 1).map(([mod]) => mod.id))
      const reloaded = reload.mock.calls.some(([payload]) => JSON.stringify(payload) === '{"type":"full-reload"}')
      for (const spy of spies) spy.mockClear()
      reload.mockClear()
      return { invalidated, reloaded }
    }
    const once = { invalidated: spies.map(() => [`\0${SERVER_APP}`]), reloaded: true }
    const declared = () => fs.readFileSync(declaration, 'utf8')

    expect(await event('add', 'server/routes/tags.controller.ts')).toEqual(once)
    expect(declared()).toContain('readonly "tags": "/tags"')
    expect(await event('change', 'server/routes/tags.controller.ts')).toEqual(once)
    expect(await event('unlink', 'server/routes/tags.controller.ts')).toEqual(once)
    expect(await event('add', 'server/routes/labels.controller.ts')).toEqual(once)
    expect(declared()).toContain('readonly "labels": "/labels"')
    expect(declared()).not.toContain('"tags"')
    expect(await event('unlink', 'server/routes/labels.controller.ts')).toEqual(once)
    expect(declared()).not.toContain('"labels"')
    expect(await event('change', 'server/routes/users/_defaults.ts')).toEqual(once)
    expect(await event('add', 'server/routes/(admin)/_defaults.ts')).toEqual(once)
    // An unrelated source changes nothing.
    expect(await event('add', 'src/other.ts')).toEqual({ invalidated: spies.map(() => []), reloaded: false })
  })

  it('keeps the previous declaration while a Controller is invalid, and the load reports its path', async () => {
    const { server, root, load, declaration } = await serve(controllerFiles)
    const before = fs.readFileSync(declaration, 'utf8')
    const invalid = path.join(root, 'server/routes/[...rest]/x.controller.ts')
    fs.mkdirSync(path.dirname(invalid), { recursive: true })
    fs.writeFileSync(invalid, '')
    server.watcher.emit('add', invalid)
    await new Promise((r) => setTimeout(r, 0))
    await expect(load(SERVER_APP)).rejects.toThrow(`invalid Controller file ${invalid}`)
    expect(fs.readFileSync(declaration, 'utf8')).toBe(before)

    fs.rmSync(invalid)
    server.watcher.emit('unlink', invalid)
    await new Promise((r) => setTimeout(r, 0))
    await expect(load(SERVER_APP)).resolves.toContain('export default')
    expect(fs.readFileSync(declaration, 'utf8')).toBe(before)
  })

  it.each([
    ['serverServices', (options: ServerServicesOptions) => [serverServices(options)]],
    ['sleekstack', sleekstack],
  ])('%s({ controllersDir: "api" }) discovers the Controllers there', async (_, plugins) => {
    const { root, src } = scaffold({ 'main.ts': 'console.log(1)\n', '../api/users.controller.ts': '' })
    fs.writeFileSync(path.join(root, 'index.html'), '<script type="module" src="/src/main.ts"></script>')
    await build({ ...config(root), plugins: plugins({ controllersDir: 'api' }), build: { write: false } })
    expect(fs.readFileSync(path.join(src, 'server.gen.d.ts'), 'utf8')).toContain('readonly "users": "/users"')
  })
})
