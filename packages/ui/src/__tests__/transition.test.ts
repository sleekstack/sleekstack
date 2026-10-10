// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Data, Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mount, type Mounted, Pending, startTransition, useAtomValue } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any, key?: string) => rawJsx(type, props, key)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const gate = () => {
  let open!: () => void
  const promise = new Promise<void>((r) => (open = r))
  return { promise, open: async () => (await act(async () => open()), await tick()) }
}

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
const go = async (app: any) => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  const errors: Array<Cause.Cause<unknown>> = []
  await act(
    async () =>
      void handles.push(
        await mount(app, {
          layer: Layer.empty,
          container,
          store,
          onError: (c: Cause.Cause<unknown>) => errors.push(c),
        } as any),
      ),
  )
  return { container, store, errors }
}

class Boom extends Data.TaggedError('Boom')<{}> {}

// `Tab` reads `tab`; each value is a new branch: a keyed Pending whose content waits on that value's gate.
const tabs = (name = 'tab') => {
  const tab = Atom.make(0)
  const other = Atom.make(0)
  const gates = new Map<number, ReturnType<typeof gate>>()
  const fail = new Set<number>()
  const gateOf = (n: number) => gates.get(n) ?? (gates.set(n, gate()), gates.get(n)!)
  const Tab = () =>
    Effect.flatMap(Effect.zipLeft(useAtomValue(tab), useAtomValue(other)), (n) =>
      jsx('p', {
        children: [
          `${name}${n}:`,
          jsx(
            Pending,
            {
              fallback: 'loading',
              children: Effect.zipRight(
                Effect.promise(() => gateOf(n).promise),
                fail.has(n) ? Effect.fail(new Boom()) : jsx('b', { children: `c${n}` }),
              ),
            },
            String(n),
          ),
        ],
      }),
    )
  return { tab, other, gateOf, fail, Tab }
}

describe('startTransition', () => {
  it('R1/R2: a transition write keeps the previous DOM until the new branch resolves; an ordinary write shows the fallback', async () => {
    const t = tabs()
    const { container, store } = await go(jsx(t.Tab, {}))
    await t.gateOf(0).open()
    expect(container.textContent).toBe('tab0:c0')
    startTransition(() => store.set(t.tab, 1))
    await tick()
    expect(container.textContent).toBe('tab0:c0')
    await t.gateOf(1).open()
    await tick()
    expect(container.textContent).toBe('tab1:c1')
    store.set(t.tab, 2)
    await tick()
    expect(container.textContent).toBe('tab2:loading')
  })

  it('R9: where a Pending has content, a transition behaves as today', async () => {
    const parent = Atom.make(0)
    const gates = [gate(), gate()]
    let forks = 0
    const Parent = () =>
      Effect.flatMap(useAtomValue(parent), (p) =>
        jsx('p', {
          children: [
            String(p),
            jsx(Pending, {
              fallback: 'loading',
              children: Effect.suspend(() => {
                const n = forks++
                return Effect.zipRight(
                  Effect.promise(() => gates[n]!.promise),
                  jsx('b', { children: `c${n}` }),
                )
              }),
            }),
          ],
        }),
      )
    const { container, store } = await go(jsx(Parent, {}))
    await gates[0]!.open()
    startTransition(() => store.set(parent, 1))
    await tick()
    expect(container.textContent).toBe('1c0')
    await gates[1]!.open()
    expect(container.textContent).toBe('1c1')
  })

  it('R10: a transition write and an ordinary write in one tick each behave as their own', async () => {
    const a = tabs('a')
    const b = tabs('b')
    const { container, store } = await go(jsx('div', { children: [jsx(a.Tab, {}), jsx(b.Tab, {})] }))
    await a.gateOf(0).open()
    await b.gateOf(0).open()
    startTransition(() => store.set(a.tab, 1))
    store.set(b.tab, 1)
    await tick()
    expect(container.textContent).toBe('a0:c0b1:loading')
  })

  it('R10: a re-run coalescing a transition and an ordinary change is ordinary', async () => {
    const t = tabs()
    const { container, store } = await go(jsx(t.Tab, {}))
    await t.gateOf(0).open()
    startTransition(() => store.set(t.tab, 1))
    store.set(t.other, 1)
    await tick()
    expect(container.textContent).toBe('tab1:loading')
  })

  it('R10: per write inside an outer store batch', async () => {
    const a = tabs('a')
    const b = tabs('b')
    const { container, store } = await go(jsx('div', { children: [jsx(a.Tab, {}), jsx(b.Tab, {})] }))
    await a.gateOf(0).open()
    await b.gateOf(0).open()
    store.batch(() => {
      startTransition(() => store.set(a.tab, 1))
      store.set(b.tab, 1)
    })
    await tick()
    expect(container.textContent).toBe('a0:c0b1:loading')
  })

  it.each([
    ['nested', (set: () => void) => startTransition(() => startTransition(set))],
    [
      'throwing',
      (set: () => void) =>
        expect(() =>
          startTransition(() => {
            set()
            throw new Error('x')
          }),
        ).toThrow('x'),
    ],
  ])('R11: a %s transition leaves no marker', async (_, write) => {
    const t = tabs()
    const { container, store } = await go(jsx(t.Tab, {}))
    await t.gateOf(0).open()
    write(() => store.set(t.tab, 1))
    await t.gateOf(1).open()
    expect(container.textContent).toBe('tab1:c1')
    store.set(t.tab, 2)
    await tick()
    expect(container.textContent).toBe('tab2:loading')
  })

  it('R3: a failed transition shows the fallback, reports, and leaves no marker', async () => {
    const t = tabs()
    t.fail.add(1)
    const { container, store, errors } = await go(jsx(t.Tab, {}))
    await t.gateOf(0).open()
    startTransition(() => store.set(t.tab, 1))
    await t.gateOf(1).open()
    await tick()
    expect(errors.length).toBe(1)
    store.set(t.tab, 2)
    await tick()
    expect(container.textContent).toBe('tab2:loading')
  })

  it('R3: a superseded transition leaves no marker; latest wins', async () => {
    const t = tabs()
    const { container, store } = await go(jsx(t.Tab, {}))
    await t.gateOf(0).open()
    startTransition(() => store.set(t.tab, 1))
    await tick()
    store.set(t.tab, 2)
    await tick()
    expect(container.textContent).toBe('tab2:loading')
    await t.gateOf(1).open()
    expect(container.textContent).toBe('tab2:loading')
    await t.gateOf(2).open()
    expect(container.textContent).toBe('tab2:c2')
  })

  it('R12: keyed rows with unchanged props are still skipped', async () => {
    const items = Atom.make([1, 2, 3])
    let runs = 0
    const Row = ({ id }: { id: number }) => (runs++, jsx('li', { children: String(id) }))
    const List = () =>
      Effect.flatMap(useAtomValue(items), (list) =>
        jsx('ul', { children: list.map((id) => jsx(Row, { id }, String(id))) }),
      )
    const { container, store } = await go(jsx(List, {}))
    expect(runs).toBe(3)
    startTransition(() => store.set(items, [1, 2, 3, 4]))
    await tick()
    expect(container.textContent).toBe('1234')
    expect(runs).toBe(4)
  })
})
