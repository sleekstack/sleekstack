// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Context, Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  defineHandler,
  hydrateMount,
  mount,
  type Mounted,
  Portal,
  PortalContainerMissing,
  Provider,
  renderToString,
  useAtomValue,
} from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}

let handles: Array<Mounted> = []
let target: HTMLElement
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
  document.body.replaceChildren()
})
const setup = () => {
  target = document.createElement('section')
  document.body.append(target)
}

// A service from a `Provider` above the portal and an atom from the mount's Store, both read inside it.
const name = Atom.make('ada')
const Inner = () =>
  Effect.flatMap(Effect.all([Greeting, useAtomValue(name)]), ([g, n]) => jsx('p', { children: `${g} ${n}` }))
const portal = (container: () => Element | null) => jsx(Portal, { container: container(), children: jsx(Inner, {}) })
const app = (show: Atom.Atom<boolean> | undefined, container: () => Element | null) =>
  jsx(Provider, {
    layer: Layer.succeed(Greeting, 'hi'),
    children: jsx('main', {
      children: show
        ? jsx(() => Effect.flatMap(useAtomValue(show), (s) => (s ? portal(container) : jsx('i', {}))), {})
        : portal(container),
    }),
  })

describe('Portal', () => {
  it('renders into its container with the surrounding Layers and Store, and follows atoms', async () => {
    setup()
    const store = makeAtomStore()
    const container = document.createElement('div')
    await act(
      async () =>
        void handles.push(
          await mount(
            app(undefined, () => target),
            { layer: Layer.empty, container, store },
          ),
        ),
    )
    expect(container.innerHTML).toBe('<main></main>')
    expect(target.innerHTML).toBe(
      '<sleek-portal style="display: contents;"><sleek-reactive style="display: contents;"><p>hi ada</p></sleek-reactive></sleek-portal>',
    )
    store.set(name, 'grace')
    await tick()
    expect(target.textContent).toBe('hi grace')
  })

  it('removes its content with the portal and with its owner, leaving other container children', async () => {
    setup()
    target.append(document.createElement('hr'))
    const store = makeAtomStore()
    const show = Atom.make(true)
    const container = document.createElement('div')
    let h!: Mounted
    await act(
      async () =>
        void (h = await mount(
          app(show, () => target),
          { layer: Layer.empty, container, store },
        )),
    )
    expect(target.textContent).toBe('hi ada')
    store.set(show, false)
    await tick()
    expect(target.innerHTML).toBe('<hr>')
    store.set(show, true)
    await tick()
    expect(target.textContent).toBe('hi ada')
    await act(() => h.dispose())
    expect(target.innerHTML).toBe('<hr>')
  })

  it.each([
    ['missing', () => null],
    ['detached', () => document.createElement('div')],
  ])('a %s container is a typed error', async (_, container) => {
    const onError = vi.fn()
    await act(
      async () =>
        void handles.push(
          await mount(app(undefined, container), {
            layer: Layer.empty,
            container: document.createElement('div'),
            onError,
          }),
        ),
    )
    const cause = onError.mock.calls[0]![0] as Cause.Cause<unknown>
    expect(Cause.squash(cause)).toBeInstanceOf(PortalContainerMissing)
  })

  it('renders nothing on the server (no handler markup) and hydrates without a mismatch', async () => {
    const handler = defineHandler('portal-click', () => Effect.void)
    const withHandler = (container: Element | null) =>
      jsx('main', { children: ['a', jsx(Portal, { container, children: jsx('button', { onClick: handler }) }), 'b'] })
    const html = await renderToString(withHandler(null), { layer: Layer.empty })
    expect(html).not.toContain('portal-click')
    expect(html).not.toContain('button')
    expect(
      await renderToString(
        app(undefined, () => null),
        { layer: Layer.succeed(Greeting, 'x') },
      ),
    ).toContain('<main></main>')

    setup()
    const container = document.createElement('div')
    container.innerHTML = html
    const onError = vi.fn()
    await act(
      async () =>
        void handles.push(await hydrateMount(withHandler(target), { layer: Layer.empty, container, onError })),
    )
    expect(onError).not.toHaveBeenCalled()
    expect(container.querySelector('main')!.textContent).toBe('ab')
    expect(target.innerHTML).toBe('<sleek-portal style="display: contents;"><button></button></sleek-portal>')

    setup()
    const c2 = document.createElement('div')
    c2.innerHTML = await renderToString(
      app(undefined, () => null),
      { layer: Layer.empty },
    )
    const store = makeAtomStore()
    await act(
      async () =>
        void handles.push(
          await hydrateMount(
            app(undefined, () => target),
            { layer: Layer.empty, container: c2, store, onError },
          ),
        ),
    )
    expect(onError).not.toHaveBeenCalled()
    expect(target.textContent).toBe('hi ada')
  })

  it('portals sharing a container keep their order across updates', async () => {
    setup()
    const store = makeAtomStore()
    const tag = Atom.make('a')
    const App = () =>
      Effect.flatMap(useAtomValue(tag), (t) =>
        jsx('main', {
          children: [
            jsx(Portal, { container: target, children: jsx(t, {}) }),
            jsx(Portal, { container: target, children: jsx('b', {}) }),
          ],
        }),
      )
    await act(
      async () =>
        void handles.push(
          await mount(jsx(App, {}), { layer: Layer.empty, container: document.createElement('div'), store }),
        ),
    )
    const order = () => [...target.querySelectorAll('a, b, s')].map((e) => e.localName)
    expect(order()).toEqual(['a', 'b'])
    store.set(tag, 's')
    await tick()
    expect(order()).toEqual(['s', 'b'])
  })

  it('a container detached after mount fails the next patch with the typed error', async () => {
    setup()
    const store = makeAtomStore()
    const n = Atom.make(0)
    const App = () =>
      Effect.flatMap(useAtomValue(n), (v) =>
        jsx(Portal, { container: target, children: jsx('p', { children: String(v) }) }),
      )
    const onError = vi.fn()
    await act(
      async () =>
        void handles.push(
          await mount(jsx(App, {}), { layer: Layer.empty, container: document.createElement('div'), store, onError }),
        ),
    )
    target.remove()
    store.set(n, 1)
    await tick()
    expect(Cause.squash(onError.mock.calls[0]![0] as Cause.Cause<unknown>)).toBeInstanceOf(PortalContainerMissing)
    expect(target.textContent).toBe('0')
  })
})
