// @vitest-environment jsdom
import { Atom } from '@sleekstack/core'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { bind, defineHandler, DuplicateBindKey, DuplicateHandler, el, fragment, mount, on, renderToString, UnsupportedEvent } from '../index'

const count = Atom.make(3)
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
    const text = Atom.make('</script><b>&\u2028\u2029')
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
    ['DuplicateBindKey', fragment(bind(count, 'n'), bind(Atom.make(1), 'n')), DuplicateBindKey],
    ['UnsupportedEvent on a raw node', { _tag: 'Element', tag: 'a', attrs: {}, children: [], on: { focus: inc } } as const, UnsupportedEvent],
  ])('rejects %s', async (_, tree, error) => {
    await expect(render(tree)).rejects.toBeInstanceOf(error)
  })

  it('on() rejects non-bubbling events', () => {
    for (const event of ['focus', 'blur', 'mouseenter', 'mouseleave', 'load', 'scroll'])
      expect(() => on(el('a'), { [event]: inc })).toThrow(UnsupportedEvent)
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
