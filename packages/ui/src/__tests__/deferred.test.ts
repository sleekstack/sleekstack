// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { jsx } from '../jsx-runtime'
import { el, mount, type Mounted, renderToString, useAtomValue, useDeferredAtom } from '../index'

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

// Renders `source/deferred` of the atom `which` points at; a run that sees a gated source value waits for its gate.
// `atoms` collects every deferred atom the instance returned, `commits` each committed text.
const setup = (initial = 0) => {
  const a = Atom.make(initial)
  const b = Atom.make(100)
  const which = Atom.make<Atom.Writable<number>>(a)
  const gates = new Map<number, Promise<void>>()
  const atoms = new Set<Atom.Atom<number>>()
  const Body = Effect.gen(function* () {
    const source = yield* useAtomValue(which)
    const deferred = yield* useDeferredAtom(source)
    atoms.add(deferred)
    const s = yield* useAtomValue(source)
    const d = yield* useAtomValue(deferred)
    const gate = gates.get(s)
    if (gate) yield* Effect.promise(() => gate)
    return el('p', {}, `${s}/${d}`)
  })
  const App = jsx(() => Body, {})
  return { a, b, which, gates, atoms, App }
}
const go = async (t: ReturnType<typeof setup>) => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  await act(async () => void handles.push(await mount(t.App as any, { layer: Layer.empty, container, store })))
  const commits: Array<string> = []
  new MutationObserver(() => commits.push(container.textContent!)).observe(container, {
    subtree: true,
    childList: true,
    characterData: true,
  })
  const [deferred] = [...t.atoms]
  const emitted: Array<number> = []
  store.subscribe(deferred!, () => emitted.push(store.get(deferred!)))
  return { container, store, commits, emitted, deferred: deferred! }
}

describe('useDeferredAtom', () => {
  it('R4/R5: commits the source first, then the deferred value; one atom per instance, released on dispose', async () => {
    const t = setup()
    const m = await go(t)
    expect(m.container.textContent).toBe('0/0')

    m.store.set(t.a, 1)
    await tick()
    expect(m.commits).toEqual(['1/0', '1/1'])
    expect(t.atoms.size).toBe(1)

    await act(async () => handles.pop()!.dispose())
    m.store.set(t.a, 2)
    await tick()
    expect(m.emitted).toEqual([1])
  })

  it('R4: waits for the commit of an async re-run, however long it takes', async () => {
    const t = setup()
    const m = await go(t)
    let open!: () => void
    t.gates.set(1, new Promise<void>((r) => (open = r)))

    m.store.set(t.a, 1)
    await tick()
    await tick()
    expect(m.store.get(m.deferred)).toBe(0)
    expect(m.container.textContent).toBe('0/0')

    open()
    await tick()
    expect(m.commits).toEqual(['1/0', '1/1'])
  })

  it('R4: a new source atom on a later run is followed, the old one no longer is', async () => {
    const t = setup()
    const m = await go(t)

    m.store.set(t.which, t.b)
    await tick()
    expect(m.container.textContent).toBe('100/100')
    m.store.set(t.a, 5)
    await tick()
    expect(m.store.get(m.deferred)).toBe(100)
    m.store.set(t.b, 101)
    await tick()
    expect(m.container.textContent).toBe('101/101')
  })

  it('R13: an unchanged source emits nothing, and a change undone within the tick emits nothing', async () => {
    const t = setup()
    const m = await go(t)

    m.store.set(t.a, 0)
    m.store.set(t.a, 5)
    m.store.set(t.a, 0)
    await tick()
    expect(m.emitted).toEqual([])
    expect(m.container.textContent).toBe('0/0')
  })

  it('R13: under string rendering it equals its source', async () => {
    const t = setup(7)
    expect(await renderToString(t.App, { layer: Layer.empty })).toContain('7/7')
  })
})
