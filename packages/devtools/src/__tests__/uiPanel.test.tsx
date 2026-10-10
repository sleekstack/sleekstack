import { Atom, makeAtomStore } from '@sleekstack/core'
import { el, mount, type Mounted, useAtomValue, useEffect, useLocal } from '@sleekstack/ui'
import { jsx as h } from '@sleekstack/ui/jsx-runtime'
import { act, cleanup, render, screen } from '@testing-library/react'
import { Effect, Layer } from 'effect'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { UiPanel, uiTrace } from '../index'

let handles: Mounted[] = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  cleanup()
  await act(async () => {
    for (const m of handles) await m.dispose()
  })
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
    await act(async () => {
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
    })
    await act(async () => {
      stores[0]!.set(count, 2)
      await new Promise((r) => setTimeout(r, 0))
    })
    render(<UiPanel trace={trace} />)

    const tree = screen.getByRole('region', { name: 'instance tree' }).textContent!
    expect(tree).toMatch(/key=k/)
    expect(tree).toMatch(/slots: atom#\d+/)
    const atoms = screen.getByRole('region', { name: 'instance atoms' }).textContent!
    expect(atoms).toMatch(/mount (\d+) #\d+ \S*key:k: atom#\d+=7 .*mount (?!\1)\d+ #\d+ \S*key:k: atom#\d+=8/)
    expect(screen.getByRole('region', { name: 're-runs' }).textContent).toMatch(
      new RegExp(`^Re-runsmount \\d+ #\\d+ \\S*key:k: atom ${count.label}$`),
    )
    expect(screen.getByRole('region', { name: 'effect runs' }).textContent).toMatch(
      /mount \d+ #\d+ \S*key:k effect \d+: start/,
    )
  })
})
