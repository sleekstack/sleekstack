// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { QueryClientLive } from '@sleekstack/query'
import { Effect } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Boundary, el, mount, type Mounted, Pending, renderToString, useAtomValue } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'
import { QueryFailed, useQuery, useQueryClient, useSuspenseQuery } from '../query'
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

describe('useSuspenseQuery', () => {
  const Data = (key: string, queryFn: (ctx: { signal: AbortSignal }) => Promise<string>) => () =>
    Effect.map(useSuspenseQuery({ queryKey: [key], queryFn, retry: false }), (d) => el('b', {}, d))
  let client: QueryClient | undefined
  const Grab = () => Effect.map(useQueryClient(), (c) => ((client = c), el('s', {}, '')))
  const observers = (key: string) =>
    client!
      .getQueryCache()
      .find({ queryKey: [key] })
      ?.getObserversCount() ?? 0

  it('resolves under Pending, retains the observer, releases it on unmount', async () => {
    let resolve!: (v: string) => void
    const show = Atom.make(true)
    const Gate = () =>
      Effect.flatMap(useAtomValue(show), (on) =>
        on
          ? jsx(Pending, {
              fallback: Effect.succeed(el('i', {}, 'loading')),
              children: jsx(
                Data('s', () => new Promise((r) => (resolve = r))),
                {},
              ),
            })
          : Effect.succeed(el('p', {}, 'off')),
      )
    const { container, store } = await go(jsx('div', { children: [jsx(Grab, {}), jsx(Gate, {})] }))
    expect(container.textContent).toBe('loading')
    expect(observers('s')).toBe(1)
    resolve('hi')
    await tick()
    expect(container.querySelector('b')!.textContent).toBe('hi')
    store.set(show, false)
    await tick()
    expect(container.textContent).toBe('off')
    expect(observers('s')).toBe(0)
  })

  it('a failed fetch surfaces QueryFailed through a Boundary', async () => {
    const tree = jsx(Boundary, {
      tag: 'QueryFailed',
      fallback: (e: QueryFailed) => Effect.succeed(el('p', {}, `caught:${(e.cause as Error).message}`)),
      children: jsx(
        Data('f', () => Promise.reject(new Error('no'))),
        {},
      ),
    })
    const { container } = await go(tree)
    expect(container.textContent).toBe('caught:no')
  })

  it('unmounting while in flight aborts the fetch and drops the observer', async () => {
    let aborted = false
    const show = Atom.make(true)
    const fn = ({ signal }: { signal: AbortSignal }) => (
      signal.addEventListener('abort', () => void (aborted = true)),
      new Promise<string>(() => {})
    )
    const Gate = () =>
      Effect.flatMap(useAtomValue(show), (on) =>
        on
          ? jsx(Pending, { fallback: Effect.succeed(el('i', {}, 'loading')), children: jsx(Data('a', fn), {}) })
          : Effect.succeed(el('p', {}, 'off')),
      )
    const { store } = await go(jsx('div', { children: [jsx(Grab, {}), jsx(Gate, {})] }))
    expect(observers('a')).toBe(1)
    store.set(show, false)
    await tick()
    expect(aborted).toBe(true)
    expect(observers('a')).toBe(0)
  })

  it('invalidation re-runs with new data, keeps the old data meanwhile, never loops, and releases the observer', async () => {
    let n = 0
    let resolve: ((v: string) => void) | undefined
    const fn = counting(() => (n++ === 0 ? Promise.resolve('v0') : new Promise<string>((r) => (resolve = r))))
    const show = Atom.make(true)
    const D = () =>
      Effect.map(useSuspenseQuery({ queryKey: ['inv'], queryFn: fn.queryFn, retry: false, staleTime: 0 }), (d) =>
        el('b', {}, d),
      )
    const Gate = () =>
      Effect.flatMap(useAtomValue(show), (on) =>
        on
          ? jsx(Pending, { fallback: Effect.succeed(el('i', {}, 'loading')), children: jsx(D, {}) })
          : Effect.succeed(el('p', {}, 'off')),
      )
    const { container, store } = await go(jsx('div', { children: [jsx(Grab, {}), jsx(Gate, {})] }))
    await tick()
    expect(container.querySelector('b')!.textContent).toBe('v0')
    await act(async () => void client!.invalidateQueries({ queryKey: ['inv'] }))
    await tick()
    expect(container.querySelector('b')!.textContent).toBe('v0')
    resolve!('v1')
    await tick()
    await tick()
    expect(container.querySelector('b')!.textContent).toBe('v1')
    expect(fn.calls).toBe(2)
    store.set(show, false)
    await tick()
    expect(observers('inv')).toBe(0)
  })

  it('awaits under renderToString without a loading state', async () => {
    expect(
      await renderToString(
        jsx(
          Data('r', async () => 'server'),
          {},
        ),
        { layer: QueryClientLive() } as any,
      ),
    ).toBe('<b>server</b>')
  })
})
