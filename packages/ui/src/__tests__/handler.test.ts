// @vitest-environment jsdom
import { Atom } from '@sleekstack/core'
import { Effect, Layer, Schema } from 'effect'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { bind, defineHandler, fromReact, DuplicateBindKey, DuplicateHandler, el, fragment, mount, on, renderToString, UnsupportedAtom, UnsupportedEvent } from '../index'

const count = Atom.serializable(Atom.make(3), { key: 'count', schema: Schema.Number })
const inc = defineHandler('inc', () => Effect.void, { preventDefault: true, stopPropagation: true })
const log = defineHandler('log', () => Effect.void)
const render = (tree: ReturnType<typeof el>) => renderToString(Effect.succeed(tree), { layer: Layer.empty })

describe('resumable server render', () => {
  it('emits handler, flag and bind attributes plus one manifest', async () => {
    const tree = fragment(on(el('button', { type: 'button' }, 'add'), { click: inc, keydown: log }), bind(count, 'n'), on(el('a'), { click: inc }), bind(count, 'n'))
    expect(await render(tree)).toBe(
      '<button type="button" data-sleek-on-click="inc" data-sleek-pd-click data-sleek-sp-click data-sleek-on-keydown="log">add</button>' +
        '<sleek-bind data-sleek-bind="n">3</sleek-bind>' +
        '<a data-sleek-on-click="inc" data-sleek-pd-click data-sleek-sp-click></a>' +
        '<sleek-bind data-sleek-bind="n">3</sleek-bind>' +
        '<script type="application/json" data-sleek-manifest>{"v":1,"events":["click","keydown"],"atoms":{"n":3}}</script>',
    )
  })

  it('keeps manifest values inert in the script', async () => {
    const text = Atom.serializable(Atom.make('</script><b>&\u2028\u2029'), { key: 't', schema: Schema.String })
    const html = await render(bind(text, 't'))
    const script = html.slice(html.indexOf('<script'))
    expect(script).toBe(
      '<script type="application/json" data-sleek-manifest>{"v":1,"events":[],"atoms":{"t":"\\u003c/script\\u003e\\u003cb\\u003e\\u0026\\u2028\\u2029"}}</script>',
    )
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(JSON.parse(doc.querySelector('script')!.textContent!).atoms.t).toBe('</script><b>&\u2028\u2029')
  })

  it.each([
    ['DuplicateHandler', fragment(on(el('a'), { click: inc }), on(el('b'), { click: defineHandler('inc', () => Effect.void) })), DuplicateHandler],
    ['DuplicateBindKey', fragment(bind(count, 'n'), bind(Atom.serializable(Atom.make(1), { key: 'one', schema: Schema.Number }), 'n')), DuplicateBindKey],
    ['UnsupportedEvent on a raw node', { _tag: 'Element', tag: 'a', attrs: {}, children: [], on: { focus: inc } } as const, UnsupportedEvent],
  ])('rejects %s', async (_, tree, error) => {
    await expect(render(tree)).rejects.toBeInstanceOf(error)
  })

  it('on() rejects non-bubbling events', () => {
    for (const event of ['focus', 'blur', 'mouseenter', 'mouseleave', 'load', 'scroll', 'invalid', 'play', 'close', 'onclick'])
      expect(() => on(el('a'), { [event]: inc })).toThrow(UnsupportedEvent)
  })

  it('encodes serializable atoms through their schema; bind and render reject non-value atoms', async () => {
    const big = Atom.serializable(Atom.make(5n), { key: 'big', schema: Schema.BigInt })
    expect(await render(bind(big, 'b'))).toContain('"atoms":{"b":"5"}')
    const res = Atom.serializable.result(Atom.make(Effect.succeed(1)), { key: 'r', schema: Schema.Number })
    expect(() => bind(res, 'r')).toThrow(UnsupportedAtom)
    expect(() => bind(Atom.make(1), 'p')).toThrow(UnsupportedAtom)
    await expect(render({ _tag: 'Bind', atom: Atom.make(1), key: 'p' })).rejects.toBeInstanceOf(UnsupportedAtom)
  })

  it('rejects handler ids and bind keys that do not round-trip through an attribute', async () => {
    await expect(render(on(el('a'), { click: defineHandler('a\rb', () => Effect.void) }))).rejects.toThrow('Invalid handler id')
    await expect(render(bind(count, 'a\u0000'))).rejects.toThrow('Invalid bind key')
  })

  it('a guest cannot forge data-sleek-* attributes', async () => {
    const raw = fromReact(() => createElement('i', { dangerouslySetInnerHTML: { __html: '<b/data-sleek-on-click=inc>' } }))
    for (const Forge of [fromReact(() => createElement('b', { 'data-sleek-on-click': 'inc' })), raw]) {
      const errors: Array<unknown> = []
      const html = await renderToString(Forge({}), { layer: Layer.empty, onError: (c) => errors.push(c) })
      expect(html).toBe('')
      expect(errors).toHaveLength(1)
    }
  })

  it('rejects user on* and data-sleek-* attributes', async () => {
    await expect(render(el('a', { onclick: 'x' }))).rejects.toThrow('Unsafe attribute')
    await expect(render(el('a', { 'data-sleek-on-click': 'inc' }))).rejects.toThrow('Unsafe attribute')
  })

  it('mount renders Bind as static text and ignores on', async () => {
    const container = document.createElement('div')
    const m = await mount(Effect.succeed(fragment(on(el('button', {}, 'add'), { click: inc }), bind(count, 'n'))), { layer: Layer.empty, container })
    expect(container.innerHTML).toBe('<button>add</button>3')
    await m.dispose()
  })
})
