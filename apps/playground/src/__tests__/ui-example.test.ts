// @vitest-environment jsdom
/**
 * The ui example (`ui/`) on `@sleekstack/ui-vite`: `vite build` yields a client and an SSR bundle and prerenders each
 * route through the server bundle; a plain static server answers the pages and the client bundle hydrates one (R4,
 * fn-30 R2/R5). The dev server renders through the server entry (R6).
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import { createBuilder, createServer } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.resolve(import.meta.dirname, '../../ui')

afterEach(() => {
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

// A plain static file server over `dir`: a path without an extension answers `<path>/index.html`.
const serveStatic = async (dir: string) => {
  const server = createHttpServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url!, 'http://localhost').pathname)
    const file = path.join(dir, pathname, path.extname(pathname) ? '' : 'index.html')
    if (!file.startsWith(dir + path.sep)) return void res.writeHead(404).end()
    readFile(file).then(
      (body) => res.writeHead(200).end(body),
      () => res.writeHead(404).end(),
    )
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { url, close: () => new Promise<void>((r) => server.close(() => r())) }
}

it.each([true, false])(
  'builds and prerenders pages that a static server answers and the browser hydrates, cssCodeSplit %s (R4, R2, R5)',
  async (cssCodeSplit) => {
    // Inside the example, so the server bundle resolves its external dependencies from the app's node_modules.
    const out = mkdtempSync(path.join(root, 'dist-test-'))
    try {
      const builder = await createBuilder({
        root,
        logLevel: 'silent',
        environments: {
          client: { build: { outDir: path.join(out, 'client'), cssCodeSplit } },
          ssr: { build: { outDir: path.join(out, 'server') } },
        },
      })
      await builder.buildApp()

      const site = await serveStatic(path.join(out, 'client'))
      let html: string
      try {
        const page = async (p: string) => {
          const response = await fetch(new URL(p, site.url))
          expect(response.status).toBe(200)
          return response.text()
        }
        html = await page('/')
        // The dynamic route from its page's `prerender()`, with and without the trailing slash.
        for (const p of ['/users/42', '/users/42/']) {
          const user = await page(p)
          expect(user).toContain('<head><meta charset="utf-8"><title>User 42</title>')
          expect(user).toContain('<h1>User 42</h1>')
        }
        expect((await fetch(new URL('/users/7', site.url))).status).toBe(404)
        const css = /<link rel="stylesheet" href="(\/assets\/[\w-]+\.css)">/.exec(html)?.[1]
        expect(css).toBeDefined()
        expect(await page(css!)).toMatch(/\S/)
      } finally {
        await site.close()
      }
      expect(html).toContain('<title>SleekStack ui example</title>')
      expect(html).toContain('<button>count 0</button>')
      const src = /<script type="module" src="\/(assets\/entry-client-[\w-]+\.js)"><\/script>/.exec(html)?.[1]
      expect(src).toBeDefined()

      document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
      const errors = vi.spyOn(console, 'error')
      const button = document.querySelector('button')!
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const client = await import(pathToFileURL(path.join(out, 'client', src!)).href)
      const started = await client.started
      onTestFinished(() => started.dispose())
      button.click()
      // Hydrated: the server's button got the listener; a fresh mount would have replaced it.
      await vi.waitFor(() => expect(button.textContent).toBe('count 1'))
      expect(document.querySelector('button')).toBe(button)
      // No HydrationMismatch: the entry's `onError` is `console.error`.
      expect(errors).not.toHaveBeenCalled()

      // Each page is its own chunk, outside the entry, loaded on first navigation (fn-65 R6).
      const assets = path.join(out, 'client', 'assets')
      const js = readdirSync(assets).filter((f) => f.endsWith('.js'))
      const chunkOf = (text: string) => js.filter((f) => readFileSync(path.join(assets, f), 'utf8').includes(text))
      const [home, user] = [chunkOf('count '), chunkOf('`User ${')]
      expect(home).toHaveLength(1)
      expect(user).toHaveLength(1)
      expect(new Set([src!.slice('assets/'.length), home[0], user[0]]).size).toBe(3)
      document.querySelector<HTMLAnchorElement>('a[href="/users/42"]')!.click()
      await vi.waitFor(() => expect(document.querySelector('h1')?.textContent).toBe('User 42'))
      expect(location.pathname).toBe('/users/42')
      expect(errors).not.toHaveBeenCalled()
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  },
)

it('the dev server answers a page through the server entry, loading the client entry from source (R6)', async () => {
  // With React guests beside it: the page carries what Vite's HTML transforms add, React's refresh preamble too.
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0 }, plugins: [react()] })
  try {
    await server.listen()
    const url = server.resolvedUrls!.local[0]!
    const html = await (await fetch(new URL('/users/7', url))).text()
    expect(html).toContain('<h1>User 7</h1>')
    expect(html).toContain('<script type="module" src="/@vite/client"></script>')
    expect(html).toContain('/@react-refresh')
    expect(html).toContain('<script type="module" src="/src/entry-client.ts"></script>')
    // Vite's own middlewares still serve the modules.
    const entry = await fetch(new URL('/src/entry-client.ts', url))
    expect(entry.headers.get('content-type')).toMatch(/javascript/)
  } finally {
    await server.close()
  }
})
