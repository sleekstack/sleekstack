// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { Head, mount, type Mounted, type Node, useAtomValue } from '../index'
import { jsx } from '../jsx-runtime'

const tick = () => new Promise((r) => setTimeout(r, 0))
let handles: Array<Mounted> = []
afterEach(async () => {
  for (const h of handles) await h.dispose()
  handles = []
  document.body.replaceChildren()
})
const run = async (app: Effect.Effect<Node>, store = makeAtomStore(), doc = document) => {
  const errors: Array<unknown> = []
  const container = doc.body.appendChild(doc.createElement('div'))
  const h = await mount(app, {
    layer: Layer.empty,
    container,
    store,
    onError: (c) => void errors.push(Cause.squash(c)),
  })
  handles.push(h)
  return { h, errors }
}
const head = () => document.head.innerHTML

// One tag of each key kind, with `v` in the value that differs between Heads.
const tags = (v: string) => [
  jsx('title', { children: `title ${v}` }),
  jsx('meta', { name: 'description', content: `desc ${v}` }),
  jsx('meta', { property: 'og:title', content: `og ${v}` }),
  jsx('link', { rel: 'alternate', href: '/feed', title: `feed ${v}` }),
]
const all = (v: string) =>
  `<title>title ${v}</title><meta name="description" content="desc ${v}">` +
  `<meta property="og:title" content="og ${v}"><link rel="alternate" href="/feed" title="feed ${v}">`

describe('Head', () => {
  it('sets title, meta and link; a nested Head wins over an outer one rendered after it', async () => {
    const Page = () => jsx('p', { children: jsx(Head, { children: jsx('title', { children: 'Page' }) }) })
    const Layout = () =>
      jsx('main', {
        children: [
          jsx(Page, {}),
          jsx(Head, {
            children: [
              jsx('title', { children: 'Site' }),
              jsx('meta', { name: 'description', content: 'site' }),
              jsx('link', { rel: 'icon', href: '/icon.svg' }),
            ],
          }),
        ],
      })
    await run(jsx(Layout, {}))
    expect(document.title).toBe('Page')
    expect(head()).toBe('<title>Page</title><meta name="description" content="site"><link rel="icon" href="/icon.svg">')
  })

  it('dedupes each key kind; unmount restores the outer entries, dispose clears them', async () => {
    const show = Atom.make(true)
    const Inner = () => jsx(Head, { children: tags('inner') })
    const Outer = () =>
      Effect.flatMap(useAtomValue(show), (s) =>
        jsx('div', { children: [jsx(Head, { children: tags('outer') }), s ? jsx(Inner, {}) : null] }),
      )
    const store = makeAtomStore()
    const { h } = await run(jsx(Outer, {}), store)
    expect(head()).toBe(all('inner'))
    store.set(show, false)
    await tick()
    expect(head()).toBe(all('outer'))
    store.set(show, true)
    await tick()
    expect(head()).toBe(all('inner'))
    await h.dispose()
    expect(head()).toBe('')
  })

  it('rejects an invalid tag or attribute like an element and reports it, keeping the valid tags', async () => {
    const { errors } = await run(
      jsx(Head, {
        children: [
          jsx('div', {}),
          jsx('sleek-guest', {}),
          jsx('meta', { name: 'x', onclick: 'alert(1)' }),
          jsx('link', { rel: 'icon', href: 'javascript:alert(1)' }),
          jsx('title', { children: 'ok' }),
        ],
      }),
    )
    expect(head()).toBe('<title>ok</title>')
    expect(errors.map((e) => (e as Error).message)).toEqual([
      'Unsupported head tag: "div"',
      'Invalid tag name: "sleek-guest"',
      'Unsafe attribute: "onclick"',
      'Unsafe attribute: "href"',
    ])
  })

  it('conflicting titles at one depth: the last mounted wins, removing it uncovers the earlier', async () => {
    const both = Atom.make(true)
    const T = (p: { t: string }) => jsx(Head, { children: jsx('title', { children: p.t }) })
    const App = () =>
      Effect.flatMap(useAtomValue(both), (b) =>
        jsx('div', { children: [jsx(T, { t: 'a' }), b ? jsx(T, { t: 'b' }) : null] }),
      )
    const store = makeAtomStore()
    await run(jsx(App, {}), store)
    expect(document.title).toBe('b')
    store.set(both, false)
    await tick()
    expect(head()).toBe('<title>a</title>')
  })

  it('Head in a keyed list dedupes by key: the last mounted row wins', async () => {
    const rows = Atom.make(['a', 'b'])
    const Row = (p: { id: string }) =>
      jsx('li', { children: jsx(Head, { children: jsx('title', { children: p.id }) }) })
    const List = () =>
      Effect.flatMap(useAtomValue(rows), (rs) => jsx('ul', { children: rs.map((id) => jsx(Row, { id }, id)) }))
    const store = makeAtomStore()
    await run(jsx(List, {}), store)
    expect(head()).toBe('<title>b</title>')
    store.set(rows, ['c', 'a', 'b'])
    await tick()
    expect(head()).toBe('<title>c</title>')
    store.set(rows, ['a', 'b'])
    await tick()
    expect(head()).toBe('<title>b</title>')
  })

  it('updating an earlier Head keeps the last mounted winning and leaves its other tags in place', async () => {
    const t = Atom.make('a1')
    const A = () =>
      Effect.flatMap(useAtomValue(t), (v) =>
        jsx(Head, { children: [jsx('title', { children: v }), jsx('link', { rel: 'stylesheet', href: '/a.css' })] }),
      )
    const B = () => jsx(Head, { children: jsx('title', { children: 'b' }) })
    const store = makeAtomStore()
    await run(jsx('div', { children: [jsx(A, {}), jsx(B, {})] }), store)
    const link = document.head.querySelector('link')
    store.set(t, 'a2')
    await tick()
    expect(document.title).toBe('b')
    expect(document.head.querySelector('link')).toBe(link)
  })

  it('takes over a tag the document already has and restores it on unmount', async () => {
    document.head.innerHTML = '<title>Shell</title><meta name="description" content="shell">'
    const { h } = await run(
      jsx(Head, {
        children: [jsx('title', { children: 'Page' }), jsx('meta', { NAME: 'description', Content: 'page' })],
      }),
    )
    expect(head()).toBe('<title>Page</title><meta name="description" content="page">')
    await h.dispose()
    expect(head()).toBe('<title>Shell</title><meta name="description" content="shell">')
    document.head.replaceChildren()
  })

  it("patches the mount container's document, not the global one", async () => {
    const other = document.implementation.createHTMLDocument('')
    await run(jsx(Head, { children: jsx('title', { children: 'framed' }) }), makeAtomStore(), other)
    expect(other.title).toBe('framed')
    expect(head()).toBe('')
  })
})
