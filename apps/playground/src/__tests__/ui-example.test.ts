// @vitest-environment jsdom
/**
 * The ui example (`ui/`) on `@sleekstack/ui-vite`: `vite build` yields a client and an SSR bundle; the server bundle
 * streams the page and the client bundle hydrates it (R4). The dev server renders through the server entry (R6).
 */
import { mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { createBuilder, createServer } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.resolve(import.meta.dirname, '../../ui')

afterEach(() => {
  document.body.innerHTML = ''
})

it.each([true, false])(
  'builds client and SSR bundles whose page renders on the server and hydrates in the browser, cssCodeSplit %s (R4)',
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

      const server = await import(pathToFileURL(path.join(out, 'server/server.js')).href)
      const response: Response = await server.default(new Request('http://localhost/'))
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('<button>count 0</button>')
      expect(html).toMatch(/<link rel="stylesheet" href="\/assets\/[\w-]+\.css">/)
      const src = /<script type="module" src="\/(assets\/entry-client-[\w-]+\.js)"><\/script>/.exec(html)?.[1]
      expect(src).toBeDefined()

      document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
      // The stream's inline scripts (the boundary swap) run as they arrive, and a browser leaves them in the page.
      for (const s of document.querySelectorAll('script:not([type])')) new Function(s.textContent!)()
      const button = document.querySelector('button')!
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const client = await import(pathToFileURL(path.join(out, 'client', src!)).href)
      await client.started
      button.click()
      // Hydrated: the server's button got the listener; a fresh mount would have replaced it.
      await vi.waitFor(() => expect(button.textContent).toBe('count 1'))
      expect(document.querySelector('button')).toBe(button)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  },
  60_000,
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
}, 60_000)
