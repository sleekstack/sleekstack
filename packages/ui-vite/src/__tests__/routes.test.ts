import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { match } from '@sleekstack/router'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../routes.js'

let server: ViteDevServer | undefined
let root = ''
afterEach(async () => {
  await server?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

/** A dev server over a fresh root whose `src/routes` holds `files` (each a page exporting its own name). */
const serve = async (...files: string[]) => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ui-vite-routes-')))
  const write = (file: string) => {
    const full = path.join(root, 'src/routes', file)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, `export default ${JSON.stringify(file)}\n`)
    return full
  }
  files.forEach(write)
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [routes()],
    server: { middlewareMode: true, hmr: false, watch: null },
  })
  const reload = vi.spyOn(server.ws, 'send')
  const load = () => server!.ssrLoadModule('virtual:sleekstack/routes')
  return { server, write, load, reload }
}

describe('routes()', () => {
  it('builds a route table the router matches, with a page per route', async () => {
    const { load } = await serve('index.ts', 'users/index.ts', 'users/[id].ts', 'users/new.tsx')
    const { table, pages } = await load()
    expect(table).toEqual({
      index: '/',
      'users/index': '/users',
      'users/new': '/users/new',
      'users/[id]': '/users/:id',
    })
    expect(pages['users/[id]']).toBe('users/[id].ts')
    expect(match(table, '/users/42')).toMatchObject({ value: { name: 'users/[id]', params: { id: '42' } } })
    expect(match(table, '/users/new')).toMatchObject({ value: { name: 'users/new' } })
  })

  it('updates on route file add and remove without a restart', async () => {
    const { server, write, load, reload } = await serve('index.ts')
    expect((await load()).table).toEqual({ index: '/' })
    const about = write('about.ts')
    server.watcher.emit('add', about)
    expect((await load()).table).toEqual({ index: '/', about: '/about' })
    expect(reload).toHaveBeenCalledWith({ type: 'full-reload' })
    fs.rmSync(about)
    server.watcher.emit('unlink', about)
    expect((await load()).table).toEqual({ index: '/' })
  })

  it.each([
    ['an invalid segment', ['users/{id}.ts'], 'users/{id}.ts'],
    ['two files with one path', ['users.ts', 'users/index.ts'], 'users/index.ts'],
  ])('reports %s naming the route file', async (_, files, bad) => {
    const { load } = await serve(...files)
    await expect(load()).rejects.toThrow(path.join(root, 'src/routes', bad))
  })
})
