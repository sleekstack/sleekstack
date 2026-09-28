import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findBrokenLinks } from '../scripts/check-links.mjs'

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
