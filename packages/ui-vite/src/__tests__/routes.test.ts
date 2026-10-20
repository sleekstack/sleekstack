import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { match } from '@sleekstack/router'
import { renderToString } from '@sleekstack/ui'
import { Layer } from 'effect'
import ts from 'typescript'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enumerate } from '../prerender/enumerate.js'
import { routes } from '../routes.js'

let server: ViteDevServer | undefined
let base = ''
afterEach(async () => {
  await server?.close()
  fs.rmSync(base, { recursive: true, force: true })
})

/**
 * A dev server over a fresh root with route `files` (each a page exporting its own name, or its `contents` entry), in
 * `src/routes` or, when `outside`, in a directory beside the root, watched for real. The root resolves this package's
 * dependencies (`@sleekstack/ui`, `@sleekstack/router`, `effect`).
 */
const serve = async (files: string[], { outside = false, contents = {} as Record<string, string> } = {}) => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ui-vite-routes-')))
  fs.symlinkSync(path.resolve(import.meta.dirname, '../../node_modules'), path.join(base, 'node_modules'))
  const root = path.join(base, 'app')
  const dir = outside ? path.join(base, 'routes') : path.join(root, 'src/routes')
  const write = (file: string) => {
    const full = path.join(dir, file)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, contents[file] ?? `export default ${JSON.stringify(file)} as const\n`)
    return full
  }
  fs.mkdirSync(root)
  files.forEach(write)
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [routes(outside ? { routesDir: '../routes' } : {})],
    server: { middlewareMode: true, hmr: false, ...(outside ? {} : { watch: null }) },
  })
  await server.pluginContainer.buildStart({})
  const reload = vi.spyOn(server.ws, 'send')
  const load = () => server!.ssrLoadModule('virtual:sleekstack/routes')
  return { server, dir, write, load, reload }
}

/** Type errors of `code` importing the route module, checked against the written declaration. */
const typeErrors = (dir: string, code: string) => {
  const consumer = path.join(dir, '..', 'consumer.ts')
  fs.writeFileSync(consumer, code)
  const program = ts.createProgram([consumer, path.join(dir, 'routes.gen.d.ts')], {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: '@sleekstack/ui',
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  })
  return ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('routes()', () => {
  it('builds a route table the router matches, with a page per route', async () => {
    const { load } = await serve(['index.ts', 'users/index.ts', 'users/[id].ts', 'users/new.tsx', 'constructor.ts'])
    const { table, pages } = await load()
    expect(table).toEqual({
      index: '/',
      constructor: '/constructor',
      'users/index': '/users',
      'users/new': '/users/new',
      'users/[id]': '/users/:id',
    })
    expect(Object.hasOwn(pages, 'constructor')).toBe(true)
    expect(Object.keys(pages['users/[id]'])).toEqual(['render'])
    expect(match(table, '/users/42')).toMatchObject({ value: { name: 'users/[id]', params: { id: '42' } } })
    expect(match(table, '/users/new')).toMatchObject({ value: { name: 'users/new' } })
  })

  it('reads optional, splat and group segments, in static, param, optional, splat order', async () => {
    const { load } = await serve([
      'files/[...path].ts',
      'files/[[name]].ts',
      'users/[[id]].ts',
      'users/[id].ts',
      'users/index.ts',
      'users/new.ts',
      '(auth)/login.ts',
      '(auth)/(inner)/index.ts',
    ])
    const { table } = await load()
    expect(Object.entries(table)).toEqual([
      ['(auth)/(inner)/index', '/'],
      ['files/[[name]]', '/files/:name?'],
      ['files/[...path]', '/files/*path'],
      ['(auth)/login', '/login'],
      ['users/index', '/users'],
      ['users/new', '/users/new'],
      ['users/[id]', '/users/:id'],
      ['users/[[id]]', '/users/:id?'],
    ])
    expect(match(table, '/users')).toMatchObject({ value: { name: 'users/index' } })
    expect(match(table, '/users/7')).toMatchObject({ value: { name: 'users/[id]' } })
    expect(match(table, '/files/a/b')).toMatchObject({ value: { name: 'files/[...path]', params: { path: 'a/b' } } })
    expect(match(table, '/login')).toMatchObject({ value: { name: '(auth)/login' } })
  })

  it('leaves out files and directories starting with _', async () => {
    const { dir, load } = await serve(['index.ts', '_helper.ts', '_lib/x.ts', 'users/_row.tsx', 'users/_parts/[id].ts'])
    const { table, pages } = await load()
    expect(table).toEqual({ index: '/' })
    expect(Object.keys(pages)).toEqual(['index'])
    expect(fs.readFileSync(path.join(dir, 'routes.gen.d.ts'), 'utf8')).not.toMatch(/_helper|_lib|_row|_parts/)
  })

  it('types the module with literal paths and each page', async () => {
    const { dir } = await serve(['index.ts', 'users/[id].ts', 'u/[[id]].ts', 'files/[...path].ts'])
    const code = `import { pages, table } from 'virtual:sleekstack/routes'
export const path: '/users/:id' = table['users/[id]']
export const optional: '/u/:id?' = table['u/[[id]]']
export const splat: '/files/*path' = table['files/[...path]']
export const page: { readonly render: () => unknown } = pages['users/[id]']
// @ts-expect-error a file without the export gives no key
pages['users/[id]'].loaders
// @ts-expect-error no such route
table['users']
`
    expect(typeErrors(dir, code)).toEqual([])
  })

  it('updates the module and its types on route file add and remove, without a restart', async () => {
    const { dir, write, load, reload } = await serve(['index.ts'], { outside: true })
    expect((await load()).table).toEqual({ index: '/' })
    const about = write('about.ts')
    await vi.waitFor(async () => expect((await load()).table).toEqual({ index: '/', about: '/about' }), 5000)
    expect(reload).toHaveBeenCalledWith({ type: 'full-reload' })
    expect(fs.readFileSync(path.join(dir, 'routes.gen.d.ts'), 'utf8')).toContain('"about": "/about"')
    fs.rmSync(about)
    await vi.waitFor(async () => expect((await load()).table).toEqual({ index: '/' }), 5000)
  })

  /** A page component: its default export renders `<h1>{text}</h1>`. */
  const component = (text: string) =>
    `import { jsx } from '@sleekstack/ui/jsx-runtime'\nexport default () => jsx('h1', { children: ${JSON.stringify(text)} })\n`
  const render = (view: () => unknown) => renderToString(view() as never, { layer: Layer.empty })

  it("makes each route file a Page from its default, loaders, fallback and prerender exports, and _notFound's notFound", async () => {
    const { load } = await serve(['index.ts', 'users/[id].ts', '_notFound.ts'], {
      contents: {
        'index.ts': component('home'),
        'users/[id].ts': `${component('user')}export const loaders = []\nexport const fallback = 'wait'\nexport const prerender = async () => [{ id: '7' }]\n`,
        '_notFound.ts': component('nope'),
      },
    })
    const routes = await load()
    const { table, pages, notFound } = routes
    expect(Object.keys(pages.index)).toEqual(['render'])
    expect(Object.keys(pages['users/[id]'])).toEqual(['render', 'loaders', 'fallback', 'prerender'])
    expect(pages['users/[id]']).toMatchObject({ loaders: [], fallback: 'wait' })
    expect(await render(pages.index.render)).toContain('<h1>home</h1>')
    expect(await render(pages['users/[id]'].render)).toContain('<h1>user</h1>')
    expect(await render(notFound)).toContain('<h1>nope</h1>')
    expect(table).toEqual({ index: '/', 'users/[id]': '/users/:id' })
    expect(await enumerate({ table, pages }, true)).toEqual({ paths: ['/', '/users/7'], warnings: [] })
  })

  it('exports no notFound without a _notFound file, and importing it is a type error', async () => {
    const { dir, load } = await serve(['index.ts'])
    expect('notFound' in (await load())).toBe(false)
    const code = `// @ts-expect-error no _notFound file
import { notFound } from 'virtual:sleekstack/routes'
`
    expect(typeErrors(dir, code)).toEqual([])
  })

  it('types router({ table, pages, notFound }) from the module as a hand-written router', async () => {
    const files = ['index.tsx', 'users/[id].ts', '_notFound.ts']
    const { dir } = await serve(files, {
      contents: {
        'index.tsx': component('home'),
        'users/[id].ts': `import { loader } from '@sleekstack/router'
import { Context, Effect, Schema } from 'effect'
export class Db extends Context.Tag('Db')<Db, { readonly name: string }>() {}
export const loaders = [loader('user', Schema.String, Db.pipe(Effect.map((db) => db.name)))]
${component('user')}`,
        '_notFound.ts': component('nope'),
      },
    })
    const code = `import { router, type Router } from '@sleekstack/router'
import { notFound, pages, table } from 'virtual:sleekstack/routes'
import Index from './routes/index.tsx'
import User, { loaders, type Db } from './routes/users/[id].ts'
import NotFound from './routes/_notFound.ts'
import { jsx } from '@sleekstack/ui/jsx-runtime'

type Needs<T> = T extends Router<any, infer R> ? R : never
const app = router({ table, pages, notFound })
const hand = router({
  table,
  pages: { index: { render: () => jsx(Index, {}) }, 'users/[id]': { render: () => jsx(User, {}), loaders } },
  notFound: () => jsx(NotFound, {}),
})
export const same: [Needs<typeof app>, Needs<typeof hand>] = [null as unknown as Needs<typeof hand>, null as unknown as Needs<typeof app>]
export const db: Db = null as unknown as Needs<typeof app>
export const needs: Needs<typeof app> = null as unknown as Db
`
    expect(typeErrors(dir, code)).toEqual([])
    expect(fs.readFileSync(path.join(dir, 'routes.gen.d.ts'), 'utf8')).not.toMatch(/^\s*(import|export) .*from/m)
  })

  it.each([
    ['a route file with no default export', ['index.ts'], ['index.ts'], { 'index.ts': 'export const loaders = []\n' }],
    [
      'a _notFound with no default export',
      ['index.ts', '_notFound.ts'],
      ['_notFound.ts'],
      { '_notFound.ts': 'export {}\n' },
    ],
  ])('reports %s naming the file', async (_, files, bad, contents) => {
    const { dir, load } = await serve(files, { contents })
    const error: Error = await load().then(
      () => new Error('loaded'),
      (e: Error) => e,
    )
    for (const file of bad) expect(error.message).toContain(path.join(dir, file))
  })

  it.each([
    ['an invalid segment', ['users/{id}.ts'], ['users/{id}.ts']],
    ['a misplaced optional', ['users/[[id]]/edit.ts'], ['users/[[id]]/edit.ts']],
    ['a misplaced splat', ['files/[...path]/raw.ts'], ['files/[...path]/raw.ts']],
    ['two files with one path', ['users.ts', 'users/index.ts'], ['users.ts', 'users/index.ts']],
    ['two files with one path through groups', ['(a)/x.ts', '(b)/x.ts'], ['(a)/x.ts', '(b)/x.ts']],
  ])('reports %s naming the route files', async (_, files, bad) => {
    const { dir, load } = await serve(files)
    const error: Error = await load().then(
      () => new Error('loaded'),
      (e: Error) => e,
    )
    for (const file of bad) expect(error.message).toContain(path.join(dir, file))
  })
})
