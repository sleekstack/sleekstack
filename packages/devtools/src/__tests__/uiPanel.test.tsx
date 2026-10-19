import { Atom, makeAtomStore } from '@sleekstack/core'
import { el, mount, type Mounted, useAtomValue, useEffect, useLocal } from '@sleekstack/ui'
import { jsx as h } from '@sleekstack/ui/jsx-runtime'
import { flush, render, type Rendered } from '@sleekstack/testing'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UiPanel, uiTrace } from '../index'

// Mounts and panel renders; this package runs vitest without globals, so `@sleekstack/testing` cannot clean up itself.
let handles: Array<Mounted | Rendered> = []
afterEach(async () => {
  for (const m of handles) await m.dispose()
  handles = []
})

describe('UiPanel', () => {
  it('shows the instance tree, atoms per instance, re-run reasons and effect runs, per mount and store', async () => {
    const count = Atom.make(1)
    const leaf = (initial: number) => () =>
      Effect.gen(function* () {
        const [n] = yield* useLocal(initial)
        const x = yield* useAtomValue(count)
        yield* useEffect(() => undefined, [x])
        return el('i', {}, `${n}${x}`)
      })
    const trace = uiTrace()
    const stores = [makeAtomStore(), makeAtomStore()]
    for (const [n, store] of stores.entries()) {
      const Root = () => h('div', { children: h(leaf(7 + n) as never, { key: 'k' }) })
      handles.push(
        await mount(h(Root as never, {}) as never, {
          layer: Layer.empty,
          container: document.createElement('div'),
          store,
          observe: trace.observer(store),
        }),
      )
    }
    stores[0]!.set(count, 2)
    await flush()
    const panel = await render(h(UiPanel as never, { trace }) as never, { layer: Layer.empty })
    handles.push(panel)
    const { container } = panel
    const section = (name: string) => container.querySelector(`section[aria-label="${name}"]`)!.textContent!

    const tree = section('instance tree')
    expect(tree).toMatch(/key=k/)
    expect(tree).toMatch(/slots: atom#\d+/)
    expect(section('instance atoms')).toMatch(
      /mount (\d+) #\d+ \S*key:k: atom#\d+=7 .*mount (?!\1)\d+ #\d+ \S*key:k: atom#\d+=8/,
    )
    expect(section('re-runs')).toMatch(new RegExp(`^Re-runsmount \\d+ #\\d+ \\S*key:k: atom ${count.label}$`))
    expect(section('effect runs')).toMatch(/mount \d+ #\d+ \S*key:k effect \d+: start/)
  })

  it('re-reads the trace every intervalMs', async () => {
    const trace = uiTrace()
    const panel = await render(h(UiPanel as never, { trace, intervalMs: 10 }) as never, { layer: Layer.empty })
    handles.push(panel)
    const { container } = panel
    expect(container.textContent).toContain('No mounted instances.')
    const store = makeAtomStore()
    const Leaf = () => Effect.map(useLocal(0), () => el('i', {}, 'x'))
    handles.push(
      await mount(h(Leaf as never, {}) as never, {
        layer: Layer.empty,
        container: document.createElement('div'),
        store,
        observe: trace.observer(store),
      }),
    )
    await flush()
    await vi.waitFor(() => expect(container.textContent).not.toContain('No mounted instances.'))
  })

  it('drops an instance its parent swapped for a plain element', async () => {
    const show = Atom.make(true)
    const Fx = () => Effect.map(useLocal(0), () => el('i', {}, 'x'))
    const App = () => Effect.flatMap(useAtomValue(show), (on) => (on ? h(Fx as never, { key: 'f' }) : h('p', {})))
    const trace = uiTrace()
    const store = makeAtomStore()
    handles.push(
      await mount(h(App as never, {}) as never, {
        layer: Layer.empty,
        container: document.createElement('div'),
        store,
        observe: trace.observer(store),
      }),
    )
    expect(trace.read().instances.some((i) => i.path.includes(':key:f'))).toBe(true)
    store.set(show, false)
    await flush()
    expect(trace.read().instances.some((i) => i.path.includes(':key:f'))).toBe(false)
  })
})
