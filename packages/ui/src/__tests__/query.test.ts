// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { QueryClientLive } from '@sleekstack/query'
import { Effect } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { el, mount, type Mounted, useAtomValue } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'
import { useQuery, useQueryClient } from '../query'
import type { QueryClient } from '@tanstack/query-core'

const jsx = (type: any, props: any) => rawJsx(type, props)
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
const go = async (app: any) => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  await act(async () => void handles.push(await mount(app, { layer: QueryClientLive(), container, store } as any)))
  return { container, store, handle: handles[handles.length - 1]! }
}

const counting = (result: () => Promise<string>) => {
  const fn = { calls: 0, queryFn: () => (fn.calls++, result()) }
  return fn
}
const Show =
  (key: string, queryFn: () => Promise<string>, tagName = 'b') =>
  () =>
    Effect.map(useQuery({ queryKey: [key], queryFn, retry: false, staleTime: 0 }), (r) =>
      el(tagName, {}, `${r.status}:${r.data ?? ''}`),
    )

describe('useQuery', () => {
  it('renders pending then the resolved result; re-renders only readers of that query', async () => {
    let resolve!: (v: string) => void
    const fn = counting(() => new Promise<string>((r) => (resolve = r)))
    let otherRuns = 0
    const Other = () => Effect.sync(() => (otherRuns++, el('i', {}, 'x')))
    const { container } = await go(jsx('div', { children: [jsx(Show('a', fn.queryFn), {}), jsx(Other, {})] }))
    expect(container.querySelector('b')!.textContent).toBe('pending:')
    resolve('hi')
    await tick()
    expect(container.querySelector('b')!.textContent).toBe('success:hi')
    expect(otherRuns).toBe(1)
  })

  it('a rejected queryFn renders status error', async () => {
    const { container } = await go(
      jsx(
        Show('e', () => Promise.reject(new Error('no'))),
        {},
      ),
    )
    await tick()
    expect(container.textContent).toBe('error:')
  })

  it('an unrelated atom change re-runs without refetching under staleTime 0', async () => {
    const fn = counting(async () => 'v')
    const a = Atom.make(0)
    const C = () =>
      Effect.zipWith(
        useAtomValue(a),
        useQuery({ queryKey: ['u'], queryFn: fn.queryFn, retry: false, staleTime: 0 }),
        (n, r) => el('b', {}, `${n}:${r.data ?? ''}`),
      )
    const { container, store } = await go(jsx(C, {}))
    await tick()
    store.set(a, 1)
    await tick()
    store.set(a, 2)
    await tick()
    expect(container.textContent).toBe('2:v')
    expect(fn.calls).toBe(1)
  })

  it('two components with one key share one fetch; the entry drops when the last scope closes', async () => {
    const fn = counting(async () => 's')
    const show = Atom.make(true)
    let client: QueryClient | undefined
    const Grab = () => Effect.map(useQueryClient(), (c) => ((client = c), el('s', {}, '')))
    const Gate = () =>
      Effect.flatMap(useAtomValue(show), (on) =>
        on
          ? jsx('div', {
              children: [jsx(Grab, {}), jsx(Show('k', fn.queryFn), {}), jsx(Show('k', fn.queryFn, 'u'), {})],
            })
          : Effect.succeed(el('p', {}, 'off')),
      )
    const { container, store } = await go(jsx(Gate, {}))
    await tick()
    expect(container.querySelector('b')!.textContent).toBe('success:s')
    expect(container.querySelector('u')!.textContent).toBe('success:s')
    expect(fn.calls).toBe(1)
    const observers = () =>
      client!
        .getQueryCache()
        .find({ queryKey: ['k'] })!
        .getObserversCount()
    expect(observers()).toBe(1)
    store.set(show, false)
    await tick()
    expect(container.textContent).toBe('off')
    expect(observers()).toBe(0)
    store.set(show, true)
    await tick()
    // A dropped entry means a fresh observer: subscribing again refetches the stale query.
    expect(fn.calls).toBe(2)
  })
})
