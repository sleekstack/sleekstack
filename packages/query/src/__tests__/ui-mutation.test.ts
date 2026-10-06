// @vitest-environment jsdom
import { makeAtomStore } from '@sleekstack/core'
import { QueryClientTag } from '../client'
import { QueryClient as Client } from '@tanstack/query-core'
import { Effect, Layer } from 'effect'
import { act, createElement } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { el, fromReact, mount, type Mounted, renderToString } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { useMutation, useQuery, UiQueryClientLive } from '../ui'

import { withTransfer } from './helpers/transfer'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
let handles: Array<Mounted> = []
beforeAll(() => void ((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true))
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
  vi.useRealTimers()
})
const go = async (app: any, container = document.createElement('div')) => {
  await act(
    async () =>
      void handles.push(await mount(app, { layer: UiQueryClientLive(), container, store: makeAtomStore() } as any)),
  )
  return container
}

// The guest calling `mutate` sits outside the reader, so the reader's re-runs never swap it.
const Button = fromReact(({ onClick }: { onClick: () => void }) => createElement('button', { onClick }, 'go'))

describe('useMutation', () => {
  it('mutate from a guest prop updates the reader; a failing mutationFn yields error and mutateAsync rejects with it', async () => {
    const boom = new Error('boom')
    let fail = false
    let mutateAsync!: (n: number) => Promise<string>
    const Reader = () =>
      Effect.flatMap(
        useMutation({ mutationFn: async (n: number) => (fail ? Promise.reject(boom) : `got ${n}`) }),
        (m) => (
          (mutateAsync = m.mutateAsync),
          jsx('div', {
            children: [
              jsx('b', { children: `${m.status}:${m.data ?? ''}` }),
              jsx(Button, { onClick: () => m.mutate(7) }),
            ],
          })
        ),
      )
    const c = await go(jsx(Reader, {}))
    expect(c.querySelector('b')!.textContent).toBe('idle:')
    await act(async () => c.querySelector('button')!.click())
    await tick()
    expect(c.querySelector('b')!.textContent).toBe('success:got 7')
    fail = true
    await act(async () => c.querySelector('button')!.click())
    await tick()
    expect(c.querySelector('b')!.textContent).toBe('error:')
    let caught: unknown
    await act(async () => void (await mutateAsync(1).catch((e) => (caught = e))))
    expect(caught).toBe(boom)
  })
})

describe('server render', () => {
  it('starts no fetch: prefetched data renders, an unprefetched query renders pending, a mutation idle', async () => {
    const client = new Client()
    client.setQueryData(['pre'], 'cached')
    const queryFn = vi.fn(async () => 'x')
    const Q = (key: string) => () =>
      Effect.map(useQuery({ queryKey: [key], queryFn }), (r) => el('b', {}, `${r.status}:${r.data ?? ''}`))
    const M = () => Effect.map(useMutation({ mutationFn: async () => 1 }), (m) => el('i', {}, m.status))
    const html = await renderToString(jsx('div', { children: [jsx(Q('pre'), {}), jsx(Q('none'), {}), jsx(M, {})] }), {
      layer: withTransfer(client),
    })
    const r = (inner: string) => `<sleek-reactive style="display: contents;">${inner}</sleek-reactive>`
    expect(html.slice(0, html.indexOf('<script'))).toBe(
      `<div>${r('<b>success:cached</b>')}${r('<b>pending:</b>')}${r('<i>idle</i>')}</div>`,
    )
    expect(queryFn).not.toHaveBeenCalled()
    expect(client.isFetching()).toBe(0)
  })
})

describe('dispose', () => {
  it('dispose and a superseding mount leave no observers or timers from this module', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const fakeSet = globalThis.setTimeout
    const fakeClear = globalThis.clearTimeout
    const pending = new Set<unknown>()
    vi.stubGlobal('setTimeout', (f: () => void, ms?: number) => {
      const id = fakeSet(() => (pending.delete(id), f()), ms)
      pending.add(id)
      return id
    })
    vi.stubGlobal('clearTimeout', (id: unknown) => (pending.delete(id), fakeClear(id as any)))
    // One client the test owns (no gc timers of its own), so what is left on it after dispose is this module's.
    const client = new Client({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } })
    let attached = 0
    const count = (e: { type: string }) =>
      void (e.type === 'observerAdded' ? attached++ : e.type === 'observerRemoved' && attached--)
    client.getQueryCache().subscribe(count)
    client.getMutationCache().subscribe(count)
    const observers = () => attached
    let mutate = () => {}
    const App = () =>
      Effect.zipWith(
        useQuery({ queryKey: ['d'], queryFn: async () => 'v' }),
        useMutation({ mutationFn: async () => 1 }),
        (q, m) => ((mutate = m.mutate), el('b', {}, `${q.status}:${m.status}`)),
      )
    const container = document.createElement('div')
    const opts = { layer: withTransfer(client), container, store: makeAtomStore() } as any
    const h1 = await act(async () => await mount(jsx(App, {}), opts))
    await act(async () => void (mutate(), await vi.advanceTimersByTimeAsync(0)))
    expect(observers()).toBe(2)
    const h2 = await act(async () => await mount(jsx(App, {}), opts))
    await act(async () => void (mutate(), await vi.advanceTimersByTimeAsync(0)))
    // The superseded mount's observers are gone: one query observer plus the new mount's one mutation observer.
    expect(observers()).toBe(2)
    await act(async () => void (await h2.dispose()))
    await act(async () => void (await h1.dispose()))
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)))
    expect({ observers: observers(), timers: pending.size, queries: client.getQueryCache().getAll().length }).toEqual({
      observers: 0,
      timers: 0,
      queries: 1,
    })
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})
