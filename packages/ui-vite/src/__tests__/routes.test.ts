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
    const { load } = await serve(['index.ts', 'users/index.ts', 'users/[id].ts', 'users/new.tsx', '__proto__.ts'])
    const { table, pages } = await load()
    expect(table).toEqual({
      index: '/',
      ['__proto__']: '/__proto__',
      'users/index': '/users',
      'users/new': '/users/new',
      'users/[id]': '/users/:id',
    })
    expect(pages.__proto__).toBe('__proto__.ts')
    expect(pages['users/[id]']).toBe('users/[id].ts')
    expect(match(table, '/users/42')).toMatchObject({ value: { name: 'users/[id]', params: { id: '42' } } })
    expect(match(table, '/users/new')).toMatchObject({ value: { name: 'users/new' } })
  })

  it('types the module with literal paths and each page', async () => {
    const { dir } = await serve(['index.ts', 'users/[id].ts'])
    const code = `import { pages, table } from 'virtual:sleekstack/routes'
export const path: '/users/:id' = table['users/[id]']
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
    ['an invalid segment', ['users/{id}.ts'], 'users/{id}.ts'],
    ['two files with one path', ['users.ts', 'users/index.ts'], 'users/index.ts'],
  ])('reports %s naming the route file', async (_, files, bad) => {
    const { dir, load } = await serve(files)
    await expect(load()).rejects.toThrow(path.join(dir, bad))
  })
})
