// @vitest-environment jsdom
import type { QueryClient } from '@tanstack/query-core'
import { type Cause, Data, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { Boundary, el, fragment, Pending, renderToStream, renderToString } from '@sleekstack/ui'
import { useQuery, useQueryClient, UiQueryClientLive } from '../ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { normalize } from './helpers/normalize'

import { withTransfer } from './helpers/transfer'

const jsx = (type: any, props: any, key?: string) => rawJsx(type, props, key)
const layer = Layer.empty
const decoder = new TextDecoder()

const gate = () => {
  let open!: () => void
  const promise = new Promise<void>((r) => (open = r))
  return { promise, open }
}

// A Pending whose content waits for `wait` (resolved immediately when absent).
const tree = (wait?: Promise<void>) => {
  const Slow = () =>
    Effect.map(
      Effect.promise(() => wait ?? Promise.resolve()),
      () => el('b', {}, 'done'),
    )
  return jsx('div', {
    children: [
      jsx('p', { children: 'head' }),
      jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Slow, {}) }),
    ],
  })
}

// Applies streamed HTML the way a browser would: parse, then run the inline scripts in order.
const apply = (html: string): string => {
  document.body.innerHTML = html
  for (const s of [...document.body.querySelectorAll('script:not([type])')]) {
    s.remove()
    new Function(s.textContent!)()
  }
  return document.body.innerHTML
}

class Boom extends Data.TaggedError('Boom')<{}> {}
const failing = (g: { promise: Promise<void> }) => () =>
  Effect.flatMap(
    Effect.promise(() => g.promise),
    () => Effect.fail(new Boom()),
  )
const drain = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  let out = ''
  for (let r = await reader.read(); !r.done; r = await reader.read()) out += decoder.decode(r.value)
  return out
}

describe('renderToStream with queries', () => {
  // Appends streamed HTML the way a parser does: nodes in order, each inline script run as it is reached.
  const feed = (container: Element, html: string) => {
    const t = document.createElement('div')
    t.innerHTML = html
    for (const n of [...t.childNodes]) {
      container.append(n)
      if (n.nodeName === 'SCRIPT' && !(n as Element).hasAttribute('type')) (n.remove(), new Function(n.textContent!)())
    }
  }
  const settle = async (act: (f: () => Promise<void>) => Promise<void>) =>
    act(() => new Promise((r) => setTimeout(r, 10)))

  it('cancel interrupts pending content, closes its scope (observer retain count 0) and drops late errors', async () => {
    const g = gate()
    let client: QueryClient | undefined
    const observers = () =>
      client
        ?.getQueryCache()
        .find({ queryKey: ['s'] })
        ?.getObserversCount() ?? 0
    const Q = () =>
      Effect.flatMap(
        useQueryClient(),
        (c) => (
          (client = c),
          Effect.flatMap(useQuery({ queryKey: ['s'], queryFn: async () => 'q', retry: false }), () =>
            Effect.flatMap(
              Effect.promise(() => g.promise),
              () => Effect.fail(new Boom()),
            ),
          )
        ),
      )
    const errors: Array<Cause.Cause<unknown>> = []
    const reader = renderToStream(jsx(Pending, { fallback: 'wait', children: jsx(Q, {}) }), {
      layer: UiQueryClientLive(),
      onError: (c) => errors.push(c),
    }).getReader()
    await reader.read()
    expect(observers()).toBe(1)
    await reader.cancel()
    expect(observers()).toBe(0)
    g.open()
    await new Promise((r) => setTimeout(r, 10))
    expect(errors).toEqual([])
  })

  it('each chunk carries its new atom and query state; hydrating the streamed DOM does not refetch', async () => {
    const { Atom, makeAtomStore } = await import('@sleekstack/core')
    const { Schema } = await import('effect')
    const { QueryClientTag } = await import('../client')
    const { QueryClient } = await import('@tanstack/query-core')
    const { act } = await import('react')
    const { hydrateMount, Store, useAtomValue } = await import('@sleekstack/ui')
    const { useSuspenseQuery } = await import('../ui')
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const count = Atom.serializable(Atom.make(0), { key: 'count', schema: Schema.Number })
    let calls = 0
    const queryFn = async () => (calls++, 'srv')
    const Q = () =>
      Effect.flatMap(useSuspenseQuery({ queryKey: ['q'], queryFn, staleTime: 60_000 }), (data) =>
        Effect.flatMap(useAtomValue(count), (n) => jsx('b', { children: `${data}:${n}` })),
      )
    const Set7 = () =>
      Effect.flatMap(Store, (s) =>
        Effect.flatMap(
          Effect.promise(() => Promise.resolve()),
          () => (s.set(count, 7), jsx(Q, {})),
        ),
      )
    const app = () =>
      jsx('div', { children: jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Set7, {}) }) })

    const html = await new Response(renderToStream(app(), { layer: withTransfer(new QueryClient()) })).text()
    // The shell's payload carries the atom set before flush; the chunk carries only what is new since: the query.
    const [shell, chunk] = html.split('</div>')
    expect(shell).not.toContain('data-sleek-hydrate')
    const payloads = [...chunk!.matchAll(/data-sleek-hydrate>([^<]*)</g)].map((m) => JSON.parse(m[1]!))
    expect(payloads.map((p) => [p.atoms, p.transfer?.queries.map((q: any) => q.queryHash)])).toEqual([
      [{ count: 7 }, undefined],
      [{}, ['["q"]']],
    ])
    expect(chunk!.indexOf('data-sleek-hydrate', chunk!.indexOf('"count"'))).toBeLessThan(chunk!.indexOf('<template'))
    expect(calls).toBe(1)

    const container = document.createElement('div')
    document.body.replaceChildren(container)
    container.innerHTML = html
    for (const s of [...container.querySelectorAll('script:not([type])')]) (s.remove(), new Function(s.textContent!)())
    const store = makeAtomStore()
    const errors: Array<unknown> = []
    let h: any
    await act(
      async () =>
        void (h = await hydrateMount(app(), {
          layer: withTransfer(new QueryClient()),
          container,
          store,
          onError: (c) => errors.push(c),
        })),
    )
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(errors).toEqual([])
    expect(container.querySelector('b')!.textContent).toBe('srv:7')
    expect(store.get(count)).toBe(7)
    expect(calls).toBe(1)
    await act(async () => void (await h.dispose()))
  })

  it('hydrating mid-stream adopts each boundary as its chunk lands: same DOM as a fully loaded hydrate, no refetch', async () => {
    const { QueryClientTag } = await import('../client')
    const { QueryClient } = await import('@tanstack/query-core')
    const { act } = await import('react')
    const { hydrateMount } = await import('@sleekstack/ui')
    const { useSuspenseQuery } = await import('../ui')
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    delete (globalThis as { __sleekGone?: unknown }).__sleekGone
    const [ga, gb, gc] = [gate(), gate(), gate()]
    let calls = 0
    const queryFn = async () => (calls++, 'srv')
    const C = () =>
      Effect.flatMap(
        Effect.promise(() => gc.promise),
        () => jsx('u', { children: 'c' }),
      )
    const B = () =>
      Effect.flatMap(
        Effect.promise(() => gb.promise),
        () =>
          Effect.flatMap(useSuspenseQuery({ queryKey: ['b'], queryFn, staleTime: 60_000 }), (d) =>
            jsx('section', {
              children: [
                jsx('b', { children: d }),
                jsx(Pending, { fallback: jsx('i', { children: 'wait c' }), children: jsx(C, {}) }),
              ],
            }),
          ),
      )
    const A = () =>
      Effect.flatMap(
        Effect.promise(() => ga.promise),
        () => jsx('a', { children: 'a' }),
      )
    const app = () =>
      jsx('div', {
        children: [
          jsx(Pending, { fallback: jsx('i', { children: 'wait a' }), children: jsx(A, {}) }),
          jsx(Pending, { fallback: jsx('i', { children: 'wait b' }), children: jsx(B, {}) }),
        ],
      })
    const qc = () => withTransfer(new QueryClient())

    const reader = renderToStream(app(), { layer: qc() }).getReader()
    const next = async () => decoder.decode((await reader.read()).value)
    const chunks = [await next()]
    ga.open()
    chunks.push(await next())
    const container = document.createElement('div')
    document.body.replaceChildren(container)
    feed(container, chunks.join(''))
    const errors: Array<unknown> = []
    let h: any
    await act(
      async () => void (h = await hydrateMount(app(), { layer: qc(), container, onError: (c) => errors.push(c) })),
    )
    expect(container.querySelector('a')!.textContent).toBe('a')
    expect(container.textContent).toContain('wait b')
    gb.open()
    const b = await next()
    await act(async () => feed(container, b))
    await settle(act)
    expect(container.querySelector('b')!.textContent).toBe('srv')
    expect(container.textContent).toContain('wait c')
    gc.open()
    const rest = await drain(reader)
    await act(async () => feed(container, rest))
    await settle(act)

    const full = document.createElement('div')
    document.body.append(full)
    feed(full, [...chunks, b, rest].join(''))
    let h2: any
    await act(
      async () =>
        void (h2 = await hydrateMount(app(), { layer: qc(), container: full, onError: (c) => errors.push(c) })),
    )
    expect(errors).toEqual([])
    expect(container.innerHTML).toBe(full.innerHTML)
    expect(container.querySelector('u')!.textContent).toBe('c')
    expect(calls).toBe(1)
    await act(async () => void (await h.dispose(), await h2.dispose()))
  })
})
