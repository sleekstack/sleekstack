// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Context, Data, Deferred, Effect, Layer, Schema } from 'effect'
import { act, createElement, useEffect, useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  Boundary,
  el,
  fromReact,
  mount,
  type Mounted,
  Provider,
  renderToString,
  Store,
  useAtomValue,
  useLocal,
  useSetAtom,
} from '@sleekstack/ui'
import type { Node } from '@sleekstack/ui'
import { Fragment, jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { useMutation, useQuery, useQueryClient, UiQueryClientLive } from '../ui'
import type { QueryClient } from '@tanstack/query-core'

const useEffectLog = (log: (e: string) => void) => useEffect(() => (log('mount'), () => log('unmount')), [])

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

// Active store subscriptions per atom, for stores made by `counted`.
const subs = new Map<unknown, number>()
const counted = () => {
  const store = makeAtomStore()
  const subscribe = store.subscribe
  vi.spyOn(store, 'subscribe').mockImplementation((atom, f) => {
    subs.set(atom, (subs.get(atom) ?? 0) + 1)
    const off = subscribe(atom, f)
    return () => (subs.set(atom, subs.get(atom)! - 1), off())
  })
  return store
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
const go = async (app: any, opts: Partial<Parameters<typeof mount>[1]> = {}) => {
  const container = document.createElement('div')
  const store = opts.store ?? makeAtomStore()
  await act(async () => void handles.push(await mount(app, { layer: Layer.empty, container, store, ...opts } as any)))
  return { container, store, handle: handles[handles.length - 1]! }
}

class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}
class Boom extends Data.TaggedError('Boom')<{}> {}
class Other extends Data.TaggedError('Other')<{}> {}

describe('reactive DOM with queries', () => {
  it('a useQuery / useMutation observer keeps its retain across an adopt and is released on kill', async () => {
    const outer = Atom.make(0)
    let client: QueryClient | undefined
    let mutate: (() => void) | undefined
    const Q = () =>
      Effect.zipWith(
        useQuery({ queryKey: ['adopt'], queryFn: async () => 'v' }),
        useMutation({ mutationFn: async () => 1 }),
        (q, m) => ((mutate = m.mutate), el('b', {}, `${q.status}:${m.status}`)),
      )
    const Outer = () =>
      Effect.flatMap(useAtomValue(outer), (o) =>
        Effect.flatMap(
          useQueryClient(),
          (c) => (
            (client = c),
            o < 2 ? Effect.map(jsx(Q, {}), (q) => el('div', {}, String(o), q)) : Effect.succeed(el('div', {}, 'gone'))
          ),
        ),
      )
    const { container, store } = await go(jsx(Outer, {}), { layer: UiQueryClientLive() as any })
    await tick()
    mutate!()
    await tick()
    expect(container.textContent).toBe('0success:success')
    const observers = () =>
      client!
        .getQueryCache()
        .find({ queryKey: ['adopt'] })!
        .getObserversCount()
    expect(observers()).toBe(1)
    store.set(outer, 1)
    await tick()
    expect(container.textContent).toBe('1success:success')
    expect(observers()).toBe(1)
    store.set(outer, 2)
    await tick()
    expect(container.textContent).toBe('gone')
    expect(observers()).toBe(0)
  })
})
