import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findBrokenLinks } from '../scripts/check-links.mjs'

describe('internal links', () => {
  it('every internal link in content/docs resolves to a page', () => {
    expect(findBrokenLinks()).toEqual([])
  })

  it('reports a link to a missing page', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'))
    writeFileSync(join(dir, 'index.mdx'), '[ok](/docs/a) [bad](/docs/missing) [ext](https://x.dev)')
    writeFileSync(join(dir, 'a.md'), '[up](./index)')
    expect(findBrokenLinks(dir)).toEqual([{ file: 'index.mdx', link: '/docs/missing' }])
  })
})
