import { Atom, makeAtomStore } from '@sleekstack/core'
import { el, mount, type Mounted, useAtomValue, useEffect, useLocal } from '@sleekstack/ui'
import { jsx as h } from '@sleekstack/ui/jsx-runtime'
import { act, cleanup, render, screen } from '@testing-library/react'
import { Effect, Layer } from 'effect'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { UiPanel, uiTrace } from '../index'

let handle: Mounted | undefined
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  cleanup()
  await act(async () => void (await handle?.dispose()))
  handle = undefined
})

describe('UiPanel', () => {
  it('shows the instance tree, atoms per instance, re-run reasons and effect runs of a mount', async () => {
    const count = Atom.make(1)
    const Leaf = () =>
      Effect.gen(function* () {
        const [n] = yield* useLocal(7)
        const x = yield* useAtomValue(count)
        yield* useEffect(() => undefined, [x])
        return el('i', {}, `${n}${x}`)
      })
    const Root = () => h('div', { children: h(Leaf as never, { key: 'k' }) })
    const store = makeAtomStore()
    const trace = uiTrace()
    await act(async () => {
      handle = await mount(h(Root as never, {}) as never, {
        layer: Layer.empty,
        container: document.createElement('div'),
        store,
        observe: trace.observe,
      })
    })
    await act(async () => {
      store.set(count, 2)
      await new Promise((r) => setTimeout(r, 0))
    })
    render(<UiPanel trace={trace} store={store} />)

    const tree = screen.getByRole('region', { name: 'instance tree' }).textContent!
    expect(tree).toMatch(/key=k/)
    expect(tree).toMatch(/slots: atom#\d+/)
    expect(screen.getByRole('region', { name: 'instance atoms' }).textContent).toMatch(/atom#\d+=7/)
    expect(screen.getByRole('region', { name: 're-runs' }).textContent).toContain(`atom ${count.label}`)
    expect(screen.getByRole('region', { name: 'effect runs' }).textContent).toMatch(/key:k effect \d+: start/)
  })
})
