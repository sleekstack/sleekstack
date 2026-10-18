// @vitest-environment node
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { JSDOM } from 'jsdom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type SearchIndex, search } from '../index.js'

const tmp: string[] = []
const copy = () => {
  const dir = join(import.meta.dirname, `.tmp-${Math.random().toString(36).slice(2)}`)
  cpSync(join(import.meta.dirname, 'fixtures/content-site'), dir, { recursive: true })
  tmp.push(dir)
  return dir
}
const run = (root: string) => build({ root, configFile: join(root, 'vite.config.ts') })
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  )

/** A plain static file server: a directory serves its `index.html`, nothing else is special. */
const serve = (root: string) => {
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }
  return createServer((req, res) => {
    let file = join(root, decodeURIComponent(new URL(req.url!, 'http://x').pathname))
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) return void res.writeHead(404).end()
    res
      .writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'text/plain' })
      .end(readFileSync(file))
  })
}

let root: string
let out: string
let http: Server
let url: string

beforeAll(async () => {
  root = copy()
  out = join(root, 'dist')
  await run(root)
  http = serve(out)
  await new Promise<void>((r) => http.listen(0, r))
  url = `http://localhost:${(http.address() as AddressInfo).port}`
})

afterAll(() => {
  http?.close()
  for (const d of tmp) rmSync(d, { recursive: true, force: true })
})

describe('static build', () => {
  it('writes one HTML file per route with content and head tags, and the client bundle', () => {
    for (const [route, title] of [
      ['', 'Home'],
      ['guide/a', 'First guide'],
      ['guide/b', 'Second guide'],
    ] as const) {
      const html = readFileSync(join(out, route, 'index.html'), 'utf8')
      expect(html).toContain(`<title>${title}</title>`)
      expect(html).toContain(`<meta property="og:title" content="${title}"`)
      expect(html).toMatch(/<h1 id="[^"]+">/)
      expect(html).toMatch(/<script type="module" src="\/assets\/[^"]+\.js">/)
    }
    expect(readdirSync(join(out, 'assets')).some((f) => f.endsWith('.js'))).toBe(true)
    expect(readFileSync(join(out, 'assets/sleek-content.css'), 'utf8')).toContain('.shiki')
  })

  it('serves from a plain static file server and every page hydrates without a mismatch', async () => {
    for (const path of ['/', '/guide/a', '/guide/b']) {
      const html = await (await fetch(`${url}${path}`)).text()
      const src = /<script type="module" src="([^"]+)"/.exec(html)![1]!
      const js = await (await fetch(`${url}${src}`)).text()
      const dom = new JSDOM(html, { url: `${url}${path}`, runScripts: 'outside-only', pretendToBeVisual: true })
      const h1 = dom.window.document.querySelector('h1')
      Object.assign(dom.window, { MessageChannel, TextEncoder, TextDecoder, queueMicrotask })
      dom.window.eval(js)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${path} did not hydrate`)), 5000)
        const poll = setInterval(() => {
          if ((dom.window as never as { sleekHydrated?: boolean }).sleekHydrated) {
            clearInterval(poll)
            clearTimeout(t)
            resolve()
          }
        }, 10)
      })
      expect((dom.window as never as { sleekErrors: unknown[] }).sleekErrors).toEqual([])
      expect(dom.window.document.querySelector('h1')).toBe(h1)
      dom.window.close()
    }
  })

  it('does not import @sleekstack/start', () => {
    for (const f of walk(out)) expect(readFileSync(f, 'utf8')).not.toContain('@sleekstack/start')
    for (const f of walk(resolve(import.meta.dirname, '..')).filter(
      (f) => /\.tsx?$/.test(f) && !f.includes('__tests__'),
    ))
      expect(readFileSync(f, 'utf8')).not.toMatch(/^import (?!type).*@sleekstack\/start/m)
  })

  it('writes a search index the client function searches offline, and prints its size', async () => {
    const index = JSON.parse(readFileSync(join(out, 'search-index.json'), 'utf8')) as SearchIndex
    expect(search(index, 'origin')[0]).toMatchObject({ title: 'First guide', anchor: '/guide/a#configuration' })
    expect(search(index, '')).toEqual([])
    expect(index.entries.every((e) => !e.text.includes('<'))).toBe(true)
  })
})

describe('build failures name the route', () => {
  it('a page that fails to render', async () => {
    const dir = copy()
    writeFileSync(join(dir, 'server.tsx'), `export const render = () => { throw new Error('boom') }\n`)
    await expect(run(dir)).rejects.toThrow('prerender /: boom')
  })

  it('a page that fails to compile', async () => {
    const dir = copy()
    writeFileSync(join(dir, 'content/guide/b.mdx'), '# Second\n\n<Unclosed>\n')
    await expect(run(dir)).rejects.toThrow(/\/guide\/b: .*b\.mdx/)
  })

  it('writes no search index when the switch is off', async () => {
    const dir = copy()
    const cfg = join(dir, 'vite.config.ts')
    writeFileSync(cfg, readFileSync(cfg, 'utf8').replace("app: 'app.ts',", "app: 'app.ts', search: false,"))
    await run(dir)
    expect(existsSync(join(dir, 'dist/search-index.json'))).toBe(false)
  })
})
