// @vitest-environment jsdom
import { Atom } from '@sleekstack/core'
import { Effect, Layer, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { bind, el, HydrateConflict, hydrateMount, mount, type Mounted, renderToString, useAtomValue, useLocal } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => new Promise((r) => setTimeout(r, 0))

let handles: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
})

const all = (root: Element): Array<globalThis.Node> => {
  const out: Array<globalThis.Node> = []
  const walk = (n: globalThis.Node) => n.childNodes.forEach((c) => (out.push(c), walk(c)))
  walk(root)
  return out
}

// Server-renders `app`, parses it into a container, and hydrates the same app there.
const serverThenHydrate = async (app: () => any) => {
  const container = document.createElement('div')
  container.innerHTML = await renderToString(app(), { layer: Layer.empty })
  const before = all(container).filter((n) => !(n.nodeType === 8))
  const onError = vi.fn()
  let h!: Mounted
  await act(async () => void (h = await hydrateMount(app(), { layer: Layer.empty, container, onError })))
  handles.push(h)
  expect(onError).not.toHaveBeenCalled()
  return { container, before }
}

describe('hydrateMount', () => {
  it('keeps every server DOM node, runs each component once, and wires onClick + useLocal at once', async () => {
    const runs = { counter: 0, label: 0 }
    const flag = Atom.make('x')
    const Label = () => (runs.label++, Effect.flatMap(useAtomValue(flag), (f) => jsx('i', { children: ['a', f, 'b'] })))
    const Counter = () =>
      Effect.flatMap(
        Effect.sync(() => runs.counter++),
        () => Effect.flatMap(useLocal(0), ([n, set]) => jsx('button', { onClick: () => set(n + 1), children: `n=${n}` })),
      )
    const App = () => jsx('div', { class: 'app', children: [jsx(Label, {}), jsx(Counter, {})] })

    const { container, before } = await serverThenHydrate(() => jsx(App, {}))
    // Server rendered each component once; hydration once more.
    expect(runs).toEqual({ counter: 2, label: 2 })
    expect(all(container)).toEqual(before)
    expect(container.querySelector('i')!.childNodes).toHaveLength(3)

    const button = container.querySelector('button')!
    await act(async () => button.click())
    await act(tick)
    expect(button.textContent).toBe('n=1')
    expect(container.querySelector('button')).toBe(button)
    expect(runs.label).toBe(2)
  })

  it('a second hydrateMount on one container rejects with HydrateConflict without running the app', async () => {
    let runs = 0
    const App = () => (runs++, jsx('p', { children: 'hi' }))
    const { container } = await serverThenHydrate(() => jsx(App, {}))
    runs = 0
    await expect(hydrateMount(jsx(App, {}), { layer: Layer.empty, container })).rejects.toBeInstanceOf(HydrateConflict)
    expect(runs).toBe(0)
    expect(container.innerHTML).toBe('<p>hi</p>')
  })

  it('mount then hydrateMount rejects with HydrateConflict; hydrateMount then mount replaces the content', async () => {
    const container = document.createElement('div')
    let m!: Mounted
    await act(async () => void (m = await mount(jsx('p', { children: 'a' }), { layer: Layer.empty, container })))
    handles.push(m)
    await expect(hydrateMount(jsx('p', { children: 'a' }), { layer: Layer.empty, container })).rejects.toMatchObject({ _tag: 'HydrateConflict' })

    const { container: c2 } = await serverThenHydrate(() => jsx('p', { children: 'a' }))
    await act(async () => void handles.push(await mount(jsx('b', { children: 'z' }), { layer: Layer.empty, container: c2 })))
    expect(c2.innerHTML).toBe('<b>z</b>')
  })

  it('a sleek-bind element unwraps to its server text node', async () => {
    const count = Atom.serializable(Atom.make(3), { key: 'count', schema: Schema.Number })
    const app = () => Effect.succeed(el('p', {}, bind(count, 'n')))
    const { container } = await serverThenHydrate(app)
    expect(container.innerHTML).toBe('<p>3</p>')
  })
})
