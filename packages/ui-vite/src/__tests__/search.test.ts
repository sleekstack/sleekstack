import { describe, expect, it } from 'vitest'
import { loadSearchIndex, search, SearchIndexMissing, searchEntries } from '../index.js'

const source = `---
title: "Widgets"
---

# Widgets

Widgets are small.

## Install

Run the install command to add a widget.

## Configure

The origin option sets the address. Install first.
`

const index = { version: 1 as const, entries: searchEntries(source, '/guide') }

describe('searchEntries', () => {
  it('splits a page into sections with heading anchors and the frontmatter title', () => {
    expect(index.entries.map((e) => [e.title, e.heading, e.anchor])).toEqual([
      ['Widgets', 'Widgets', '/guide#widgets'],
      ['Widgets', 'Install', '/guide#install'],
      ['Widgets', 'Configure', '/guide#configure'],
    ])
  })
})

describe('search', () => {
  it('ranks a heading hit above a text hit and returns title, anchor and snippet', () => {
    const [first, second] = search(index, 'install')
    expect(first).toMatchObject({ title: 'Widgets', anchor: '/guide#install' })
    expect(first!.snippet).toContain('install command')
    expect(second!.anchor).toBe('/guide#configure')
  })

  it('requires every term', () =>
    expect(search(index, 'install origin').map((e) => e.anchor)).toEqual(['/guide#configure']))

  it.each(['', '   ', '!!'])('returns nothing for the empty query %j', (q) => expect(search(index, q)).toEqual([]))

  it.each([undefined, null, { version: 2, entries: [] }])('throws for a missing index %j', (bad) =>
    expect(() => search(bad as never, 'x')).toThrow(SearchIndexMissing),
  )

  it('loads an index and reports a missing one as an error', async () => {
    const ok = async () => new Response(JSON.stringify(index))
    expect(search(await loadSearchIndex('/i.json', ok as never), 'origin')).toHaveLength(1)
    await expect(loadSearchIndex('/i.json', (async () => new Response('', { status: 404 })) as never)).rejects.toThrow(
      SearchIndexMissing,
    )
  })
})
