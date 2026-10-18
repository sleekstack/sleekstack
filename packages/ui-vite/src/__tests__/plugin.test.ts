import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as listen, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { sleekContent } from '../index.js'

const root = mkdtempSync(join(resolve(import.meta.dirname, '../..'), '.tmp-dev-'))
const content = join(root, 'content')
const page = (name: string) => join(content, name)
let vite: ViteDevServer
let http: Server
let url: string

beforeAll(async () => {
  mkdirSync(content)
  writeFileSync(join(content, 'meta.json'), '{"pages":["index","a"]}')
  writeFileSync(page('index.mdx'), '# Home\n')
  writeFileSync(page('a.mdx'), '# A\n')
  writeFileSync(
    join(root, 'app.ts'),
    `import { routes } from 'virtual:sleek-content'
export const app = { fetch: async (r: Request) => new Response(JSON.stringify({ path: new URL(r.url).pathname, routes })) }\n`,
  )
  vite = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true },
    plugins: [sleekContent({ content, base: '/docs', app: 'app.ts' })],
  })
  http = listen(vite.middlewares)
  await new Promise<void>((r) => http.listen(0, r))
  url = `http://localhost:${(http.address() as AddressInfo).port}`
})

afterAll(async () => {
  http.close()
  await vite.close()
  rmSync(root, { recursive: true, force: true })
})

describe('dev entry', () => {
  it('serves a route through the start fetch handler and lets other paths reach Vite', async () => {
    const hit = await (await fetch(`${url}/docs/a`)).json()
    expect(hit).toMatchObject({ path: '/docs/a', routes: { index: '/docs', a: '/docs/a' } })
    expect((await fetch(`${url}/nope`)).status).toBe(404)
  })

  it('updates the table when a page is added or removed', async () => {
    const send = vi.spyOn(vite.ws, 'send')
    writeFileSync(page('b.mdx'), '# B\n')
    vite.watcher.emit('add', page('b.mdx'))
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' })
    expect(((await (await fetch(`${url}/docs/b`)).json()) as { routes: object }).routes).toHaveProperty('b', '/docs/b')
    rmSync(page('b.mdx'))
    vite.watcher.emit('unlink', page('b.mdx'))
    expect(((await (await fetch(`${url}/docs/a`)).json()) as { routes: object }).routes).not.toHaveProperty('b')
  })

  it('shows a content error in the overlay and clears it on the fix', async () => {
    const send = vi.spyOn(vite.ws, 'send')
    send.mockClear()
    writeFileSync(page('a.mdx'), '# A\n\n```nolang-xyz\nx\n```\n')
    vite.watcher.emit('change', page('a.mdx'))
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          err: expect.objectContaining({ message: expect.stringContaining('a.mdx') }),
        }),
      ),
    )
    send.mockClear()
    writeFileSync(page('a.mdx'), '# A\n')
    vite.watcher.emit('change', page('a.mdx'))
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith({ type: 'full-reload' }))
  })

  it('compiles a page through the Vite transform', async () => {
    const out = await vite.transformRequest(page('index.mdx'), { ssr: true })
    expect(out?.code).toContain('jsx-runtime')
  })
})
