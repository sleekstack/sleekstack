import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findBrokenLinks } from '../scripts/check-links.mjs'
import { rewriteAnchors } from '../scripts/generate-api.mjs'

describe('internal links', () => {
  it('every internal link in content/docs resolves to a page and heading', () => {
    expect(findBrokenLinks()).toEqual([])
  })

  it('reports missing pages, missing headings and broken reference links', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'))
    writeFileSync(
      join(dir, 'index.mdx'),
      '# Top\n\n[ok](/docs/a#sub) [self](#top) [bad](/docs/missing) [ext](https://x.dev) [hash](/docs/a#nope) [ref][t]\n\n[t]: /docs/gone\n',
    )
    writeFileSync(join(dir, 'a.md'), '## Sub\n\n[up](/docs) [idx](./index)\n')
    expect(findBrokenLinks(dir)).toEqual([
      { file: 'a.md', link: './index' },
      { file: 'index.mdx', link: '/docs/missing' },
      { file: 'index.mdx', link: '/docs/a#nope' },
      { file: 'index.mdx', link: '/docs/gone' },
    ])
  })
})

describe('relative links', () => {
  it('resolve against the page URL like a browser (on /docs, ./concepts is /concepts)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rel-'))
    writeFileSync(join(dir, 'index.mdx'), '# Home\n\n[bad](./concepts) [ok](./docs/concepts)\n')
    writeFileSync(join(dir, 'concepts.mdx'), '# Concepts\n\n[ok](./index) [sib](./other)\n')
    writeFileSync(join(dir, 'other.mdx'), '# Other\n')
    expect(findBrokenLinks(dir)).toEqual([
      { file: 'concepts.mdx', link: './index' },
      { file: 'index.mdx', link: './concepts' },
    ])
  })
})

describe('API anchor rewrite', () => {
  it('targets the symbol heading the link names, even when TypeDoc’s anchor exists elsewhere', () => {
    const raw = [
      '### build()',
      '#### module',
      'x',
      '### Module',
      '#### module',
      '### module()',
      '[`Module`](#module) [module](#module-2) [build](#build) [x](index.md#module-1)',
    ].join('\n\n')
    expect(rewriteAnchors(raw, '/docs/api/core').split('\n\n').at(-1)).toBe(
      '[`Module`](#module-1) [module](#module-3) [build](#build) [x](/docs/api/core#module-1)',
    )
  })
})
