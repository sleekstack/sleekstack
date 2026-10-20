import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { match } from '@sleekstack/router'
import ts from 'typescript'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../routes.js'

let server: ViteDevServer | undefined
let base = ''
afterEach(async () => {
  await server?.close()
  fs.rmSync(base, { recursive: true, force: true })
})

/**
 * A dev server over a fresh root with route `files` (each a page exporting its own name), in `src/routes` or, when
 * `outside`, in a directory beside the root, watched for real.
 */
const serve = async (files: string[], { outside = false } = {}) => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ui-vite-routes-')))
  const root = path.join(base, 'app')
  const dir = outside ? path.join(base, 'routes') : path.join(root, 'src/routes')
  const write = (file: string) => {
    const full = path.join(dir, file)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, `export default ${JSON.stringify(file)} as const\n`)
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
    expect(pages['users/[id]']).toBe('users/[id].ts')
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
export const page: 'users/[id].ts' = pages['users/[id]']
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
