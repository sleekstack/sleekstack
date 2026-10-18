// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { Head, mount, type Mounted, renderToString, useAtomValue } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any, key?: string) => rawJsx(type, props, key)
const layer = Layer.empty
const tags = (...kids: Array<unknown>) => jsx(Head, { children: kids })
const title = (t: string) => jsx('title', { children: t })
const meta = (attrs: Record<string, string>) => jsx('meta', attrs)
const page = (...kids: Array<unknown>) => jsx('main', { children: kids })

const head = async (app: Effect.Effect<any, any, never>): Promise<string> => {
  let out = ''
  await renderToString(app, { layer, onHead: (h) => (out = h) })
  return out
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('Head in renderToString', () => {
  it('returns title, meta and link through onHead, not in the body', async () => {
    let out = ''
    const html = await renderToString(
      page(
        tags(title('A & B'), meta({ name: 'description', content: 'd' }), jsx('link', { rel: 'icon', href: '/i.png' })),
      ),
      { layer, onHead: (h) => (out = h) },
    )
    expect(out).toBe('<title>A &amp; B</title><meta name="description" content="d"><link rel="icon" href="/i.png">')
    expect(html).toBe('<main></main>')
  })

  it('the deepest Head wins a key, wherever it is written; other keys merge', async () => {
    const Child = () => tags(title('child'), meta({ name: 'a', content: 'child' }))
    const Layout = (p: { children: unknown }) =>
      jsx('div', {
        children: [
          p.children,
          tags(title('layout'), meta({ name: 'a', content: 'layout' }), meta({ name: 'b', content: 'b' })),
        ],
      })
    expect(await head(jsx(Layout, { children: jsx(Child, {}) }))).toBe(
      '<title>child</title><meta name="a" content="child"><meta name="b" content="b">',
    )
  })

  it('dedupes meta[property] and link[rel]+href by key, later of equal depth wins', async () => {
    expect(
      await head(
        page(
          tags(meta({ property: 'og:title', content: '1' }), jsx('link', { rel: 'a', href: '/x' })),
          tags(
            meta({ property: 'og:title', content: '2' }),
            jsx('link', { rel: 'a', href: '/x' }),
            jsx('link', { rel: 'a', href: '/y' }),
          ),
        ),
      ),
    ).toBe('<meta property="og:title" content="2"><link rel="a" href="/x"><link rel="a" href="/y">')
  })

  it.each([
    ['a tag outside title, meta and link', () => tags(jsx('script', {}))],
    ['an unsafe attribute', () => tags(meta({ name: 'x', content: 'y', onclick: 'z' }))],
    ['a javascript: url', () => tags(jsx('link', { rel: 'a', href: 'javascript:alert(1)' }))],
    ['children on a meta', () => tags(jsx('meta', { name: 'x', children: 'y' }))],
    ['an element inside title', () => tags(jsx('title', { children: jsx('b', {}) }))],
  ])('rejects %s like an element', async (_, build) => {
    await expect(renderToString(build(), { layer })).rejects.toBeInstanceOf(TypeError)
  })
})

describe('Head under mount', () => {
  let handle: Mounted | undefined
  afterEach(async () => {
    await handle?.dispose()
    await tick()
    document.head.innerHTML = ''
  })
  const container = () => document.createElement('div')

  it('patches document.head with nested overrides and removes the tags on dispose', async () => {
    const Child = () => tags(title('child'))
    handle = await mount(page(tags(title('page'), meta({ name: 'a', content: '1' })), jsx(Child, {})), {
      layer,
      container: container(),
    })
    await tick()
    expect(document.head.innerHTML).toBe('<meta name="a" content="1"><title>child</title>')
    await handle.dispose()
    await tick()
    expect(document.head.innerHTML).toBe('')
  })

  it('a component that unmounts while its parent stays takes only its tags, and the shallower title returns', async () => {
    const show = Atom.make(true)
    const Child = () => tags(title('child'), meta({ name: 'c', content: '1' }))
    const Page = () =>
      Effect.flatMap(useAtomValue(show), (on) =>
        jsx('main', { children: [tags(title('page')), on ? jsx(Child, {}) : null] }),
      )
    const store = makeAtomStore()
    handle = await mount(jsx(Page, {}), { layer, container: container(), store })
    await tick()
    expect(document.head.innerHTML).toBe('<title>child</title><meta name="c" content="1">')
    store.set(show, false)
    await tick()
    expect(document.head.innerHTML).toBe('<title>page</title>')
  })

  it('updates a tag in place when its value changes', async () => {
    const n = Atom.make('1')
    const Page = () => Effect.flatMap(useAtomValue(n), (v) => tags(meta({ name: 'a', content: v })))
    const store = makeAtomStore()
    handle = await mount(jsx(Page, {}), { layer, container: container(), store })
    await tick()
    const tag = document.head.querySelector('meta')
    store.set(n, '2')
    await tick()
    expect(document.head.innerHTML).toBe('<meta name="a" content="2">')
    expect(document.head.querySelector('meta')).toBe(tag)
  })
})
