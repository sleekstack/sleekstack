// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Context, Effect, Layer, Schema } from 'effect'
import { act, createElement, useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  bind,
  Boundary,
  el,
  Pending,
  fromReact,
  HydrateConflict,
  HydrationMismatch,
  hydrateMount,
  mount,
  type Mounted,
  renderToString,
  Store,
  useAtomValue,
  useLocal,
} from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { useQuery } from '../ui'
import { QueryClientTag } from '../client'
import { QueryClient } from '@tanstack/query-core'

import { withTransfer } from './helpers/transfer'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => new Promise((r) => setTimeout(r, 0))

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

const all = (root: Element): Array<globalThis.Node> => {
  const out: Array<globalThis.Node> = []
  const walk = (n: globalThis.Node) => n.childNodes.forEach((c) => (out.push(c), walk(c)))
  walk(root)
  return out
}

// Server-renders `app`, parses it into a container, and hydrates the same app there.
const serverThenHydrate = async (app: () => any) => {
  const container = document.createElement('div')
  container.innerHTML = await renderToString(app(), { layer: Layer.empty })
  const before = all(container).filter((n) => !(n.nodeType === 8))
  const onError = vi.fn()
  let h!: Mounted
  await act(async () => void (h = await hydrateMount(app(), { layer: Layer.empty, container, onError })))
  handles.push(h)
  expect(onError).not.toHaveBeenCalled()
  return { container, before }
}

describe('hydrateMount with queries', () => {
  it('server query state is the client initial value with no refetch', async () => {
    let calls = 0
    const queryFn = async () => (calls++, 'srv')
    const Q = () =>
      Effect.map(useQuery({ queryKey: ['q'], queryFn, staleTime: 60_000 }), (r) =>
        el('b', {}, `${r.status}:${r.data ?? ''}`),
      )
    const server = new QueryClient()
    await server.prefetchQuery({ queryKey: ['q'], queryFn })
    const container = document.createElement('div')
    container.innerHTML = await renderToString(jsx(Q, {}), { layer: withTransfer(server) })
    expect(calls).toBe(1)
    const onError = vi.fn()
    await act(
      async () =>
        void handles.push(
          await hydrateMount(jsx(Q, {}), {
            layer: withTransfer(new QueryClient()),
            container,
            onError,
          }),
        ),
    )
    await act(tick)
    expect(onError).not.toHaveBeenCalled()
    expect(container.querySelector('b')!.textContent).toBe('success:srv')
    expect(calls).toBe(1)
  })
})
