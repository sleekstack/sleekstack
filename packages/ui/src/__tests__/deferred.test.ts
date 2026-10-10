// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { jsx } from '../jsx-runtime'
import { el, mount, type Mounted, renderToString, useAtomValue, useDeferredAtom } from '../index'

// No act here: async act drains past the macrotask the deferred atom waits for.
const microtasks = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

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

// Renders `source/deferred`; `atoms` collects every deferred atom the instance returned, `emitted` its emissions.
const setup = (initial = 0) => {
  const source = Atom.make(initial)
  const atoms = new Set<Atom.Atom<number>>()
  const emitted: Array<number> = []
  const Body = Effect.gen(function* () {
    const deferred = yield* useDeferredAtom(source)
    atoms.add(deferred)
    const s = yield* useAtomValue(source)
    const d = yield* useAtomValue(deferred)
    return el('p', {}, `${s}/${d}`)
  })
  const App = jsx(() => Body, {})
  return { source, atoms, emitted, App }
}

describe('useDeferredAtom', () => {
  it('R4/R5: follows the source after the commit settles; one atom per instance, released on dispose', async () => {
    const t = setup()
    const container = document.createElement('div')
    const store = makeAtomStore()
    await act(async () => void handles.push(await mount(t.App as any, { layer: Layer.empty, container, store })))
    expect(container.textContent).toBe('0/0')
    const [deferred] = [...t.atoms]
    store.subscribe(deferred!, () => t.emitted.push(store.get(deferred!)))

    store.set(t.source, 1)
    await microtasks()
    expect(container.textContent).toBe('1/0')
    await tick()
    expect(container.textContent).toBe('1/1')
    expect(t.atoms.size).toBe(1)

    await act(async () => handles.pop()!.dispose())
    store.set(t.source, 2)
    await tick()
    expect(t.emitted).toEqual([1])
  })

  it('R13: an unchanged source emits nothing, and a change undone within the tick emits nothing', async () => {
    const t = setup()
    const container = document.createElement('div')
    const store = makeAtomStore()
    await act(async () => void handles.push(await mount(t.App as any, { layer: Layer.empty, container, store })))
    const [deferred] = [...t.atoms]
    store.subscribe(deferred!, () => t.emitted.push(store.get(deferred!)))

    store.set(t.source, 0)
    store.set(t.source, 5)
    store.set(t.source, 0)
    await tick()
    expect(t.emitted).toEqual([])
    expect(container.textContent).toBe('0/0')
  })

  it('R13: under string rendering it equals its source', async () => {
    const t = setup(7)
    expect(await renderToString(t.App, { layer: Layer.empty })).toContain('7/7')
  })
})
