import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { run } from '@mdx-js/mdx'
import { renderToString } from '@sleekstack/ui'
import * as runtime from '@sleekstack/ui/jsx-runtime'
import { Layer } from 'effect'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assertLinks,
  compileMdx,
  createStyleSheet,
  findBrokenLinks,
  headingIds,
  contentRouteTable,
  rebaseLink,
  scanPages,
} from '../index.js'

const docs = resolve(import.meta.dirname, '../../../../apps/docs/content/docs')

const tree = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'content-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

describe('route table', () => {
  const dir = tree({
    'meta.json': '{"pages":["index","b","guides"]}',
    'a.md': '# A',
    'b.mdx': '# B',
    'index.mdx': '# Home',
    'guides/x.mdx': '# X',
    'guides/index.mdx': '# Guides',
  })

  it('follows the order file, unlisted pages last', () => {
    expect(contentRouteTable(scanPages(dir))).toEqual({
      index: '/',
      b: '/b',
      guides: '/guides',
      'guides/x': '/guides/x',
      a: '/a',
    })
    expect(Object.keys(contentRouteTable(scanPages(dir)))).toEqual(['index', 'b', 'guides', 'guides/x', 'a'])
  })

  it('applies a base prefix to every route', () => {
    expect(contentRouteTable(scanPages(dir, { base: '/docs/' }))).toMatchObject({
      index: '/docs',
      b: '/docs/b',
      'guides/x': '/docs/guides/x',
    })
  })

  it('reflects an added and a removed page on the next scan', () => {
    const d = tree({ 'index.mdx': '# Home' })
    expect(Object.keys(contentRouteTable(scanPages(d)))).toEqual(['index'])
    writeFileSync(join(d, 'new.mdx'), '# New')
    expect(Object.keys(contentRouteTable(scanPages(d)))).toEqual(['index', 'new'])
  })

  it('reads the real docs order file', () => {
    const names = Object.keys(contentRouteTable(scanPages(docs)))
    expect(names.slice(0, 4)).toEqual(['index', 'getting-started-effect', 'concepts', 'atoms'])
  })
})

describe('rebaseLink', () => {
  const r = { from: '/docs', to: '/site/' }
  it.each([
    ['/docs', '/site'],
    ['/docs/a#x', '/site/a#x'],
    ['/docs#x', '/site#x'],
    ['/docsy', '/docsy'],
    ['./a', './a'],
    ['https://x.dev/docs', 'https://x.dev/docs'],
  ])('%s -> %s', (url, out) => expect(rebaseLink(url, r)).toBe(out))

  it('a root base keeps the link absolute', () => {
    expect(rebaseLink('/docs', { from: '/docs', to: '/' })).toBe('/')
    expect(rebaseLink('/docs#x', { from: '/docs', to: '/' })).toBe('/#x')
  })
})

describe('link validation', () => {
  const bad = tree({
    'index.mdx':
      '# Top\n\n[ok](/docs/a#sub) [self](#top) [bad](/docs/missing) [ext](https://x.dev) [hash](/docs/a#nope) [ref][t]\n\n[t]: /docs/gone\n',
    'a.md': '## Sub\n\n[up](/docs) [rel](./index) [sib](./other)\n',
  })

  it('names the source and the target of each broken link or anchor', () => {
    expect(findBrokenLinks(scanPages(bad, { base: '/docs' }), bad)).toEqual([
      { file: 'index.mdx', link: '/docs/missing' },
      { file: 'index.mdx', link: '/docs/a#nope' },
      { file: 'index.mdx', link: '/docs/gone' },
      { file: 'a.md', link: './index' },
      { file: 'a.md', link: './other' },
    ])
    expect(() => assertLinks(scanPages(bad, { base: '/docs' }), bad)).toThrow(/index\.mdx -> \/docs\/missing/)
  })

  it('passes on the real docs (the generated /docs/api pages are not in the tree)', () => {
    const broken = findBrokenLinks(scanPages(docs, { base: '/docs' }), docs)
    // the generated api/ tree may be present, absent or half-written (docs generate:api runs in parallel)
    expect(broken.filter((b) => !b.link.startsWith('/docs/api') && !b.file.startsWith('api/'))).toEqual([])
  })

  it('a heading of inline code keeps its underscore, as the MDX pipeline renders it (`_tag` is #_tag, not #tag)', async () => {
    const source = '## `_tag`\n\n## snake_case and _em_\n'
    const code = await compileMdx(source, { file: 'x.mdx', styles: createStyleSheet(), outputFormat: 'function-body' })
    const mod = await run(code, runtime as never)
    const html = await renderToString((mod.default as (p: object) => never)({}), { layer: Layer.empty })
    const rendered = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((m) => m[1])
    expect(headingIds(source)).toEqual(['_tag', 'snake_case-and-em'])
    expect(rendered).toEqual(headingIds(source))
    const dir = tree({ 'index.mdx': '# Top\n\n[ok](/docs/a#_tag) [bad](/docs/a#tag)\n', 'a.mdx': source })
    expect(findBrokenLinks(scanPages(dir, { base: '/docs' }), dir)).toEqual([
      { file: 'index.mdx', link: '/docs/a#tag' },
    ])
  })

  it('heading ids equal the ids the MDX pipeline renders, on every real page', async () => {
    // the generated api/ tree may be absent or half-written while docs generate:api runs; the `_tag` case is covered above
    for (const { file } of scanPages(docs).filter((p) => !p.file.includes('/api/'))) {
      const source = readFileSync(file, 'utf8')
      const code = await compileMdx(source, { file, styles: createStyleSheet(), outputFormat: 'function-body' })
      const mod = await run(code, runtime as never)
      const html = await renderToString((mod.default as (p: object) => never)({}), { layer: Layer.empty })
      const rendered = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((m) => m[1])
      expect({ file, ids: headingIds(source) }).toEqual({ file, ids: rendered })
    }
  })
})
