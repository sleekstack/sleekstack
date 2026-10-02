/**
 * packages/react/src/__tests__/hydrate.test.tsx
 *
 * SSR prefetch + <HydrateQueries> (fn-12 task .6, R7): server reads, first-paint client data, nested providers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { prerender } from 'react-dom/static'
import React, { Suspense } from 'react'
import { Effect, Schema } from 'effect'
import { Hydrate, Query } from '@sleekstack/query'
import { HydrateQueries, LayerProvider, useQuery } from '../index'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); Hydrate.setServerRunner(undefined) })

const setup = () => {
  const calls = { n: 0 }
  const todo = Hydrate.hydratable(
    Query.make({ key: (id: string) => ['todo', id], fetch: (id) => Effect.sync(() => `${id}#${++calls.n}`), staleTime: '1 minute' }),
    { value: Schema.String },
  )
  const Show = ({ id }: { id: string }) => { const { data } = useQuery(todo(id)); return <i>{data ?? 'pending'}</i> }
  return { todo, calls, Show }
}
const html = async (node: React.ReactNode) => {
  const { prelude } = await prerender(node)
  return new Response(prelude).text()
}

describe('HydrateQueries', () => {
  it('server HTML contains prefetched data; a nested provider reads the root store', async () => {
    const { todo, calls, Show } = setup()
    const state = await Effect.runPromise(Hydrate.prefetch([todo('a')]) as Effect.Effect<Hydrate.Dehydrated>)
    vi.stubGlobal('window', undefined)
    const out = renderToString(
      <LayerProvider provide={[]}><HydrateQueries state={state}><LayerProvider provide={[]}><Show id="a" /></LayerProvider></HydrateQueries></LayerProvider>,
    )
    expect(out).toContain('a#1')
    expect(calls.n).toBe(1)
  })

  it('an un-prefetched key on the server suspends on the server runner and resolves', async () => {
    const { Show } = setup()
    Hydrate.setServerRunner((atoms) => Effect.runPromise(Hydrate.prefetch(atoms) as Effect.Effect<Hydrate.Dehydrated>))
    vi.stubGlobal('window', undefined)
    expect(await html(<LayerProvider provide={[]}><Suspense fallback="loading"><Show id="b" /></Suspense></LayerProvider>)).toContain('b#1')
  })

  it('the client renders hydrated data on first paint without refetching until stale', async () => {
    const { todo, calls, Show } = setup()
    const state = await Effect.runPromise(Hydrate.prefetch([todo('c')]) as Effect.Effect<Hydrate.Dehydrated>)
    render(
      <LayerProvider provide={[]}>
        <Suspense fallback="loading">
          <HydrateQueries state={state}><LayerProvider provide={[]}><Show id="c" /></LayerProvider></HydrateQueries>
        </Suspense>
      </LayerProvider>,
    )
    expect(await screen.findByText('c#1')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 20))
    expect(calls.n).toBe(1)
  })

  it('a lazily fetched server entry reaches the client without a refetch; a Schema-failing entry refetches on the server', async () => {
    const { Show, calls } = setup()
    Hydrate.setServerRunner((atoms) => Effect.runPromise(Hydrate.prefetch(atoms) as Effect.Effect<Hydrate.Dehydrated>))
    const bad: Hydrate.Dehydrated = [{ key: '["todo","d"]', result: 'success', value: 42, updatedAt: Date.now() }]
    const tree = <LayerProvider provide={[]}><Suspense fallback="loading"><HydrateQueries state={bad}><Show id="d" /></HydrateQueries></Suspense></LayerProvider>
    vi.stubGlobal('window', undefined)
    const out = await html(tree)
    vi.unstubAllGlobals()
    expect(out).toContain('d#1')
    expect(calls.n).toBe(1)
    const container = document.createElement('div')
    container.innerHTML = out
    document.body.appendChild(container)
    const errors = vi.spyOn(console, 'error')
    await act(async () => { hydrateRoot(container, tree) })
    await new Promise((r) => setTimeout(r, 20))
    expect(container.textContent).toContain('d#1')
    expect(calls.n).toBe(1)
    expect(errors.mock.calls.filter((c) => /hydrat/i.test(String(c[0])))).toEqual([]) // no hydration mismatch
  })

  it('a rejected server fetch reaches the renderer', async () => {
    const { Show } = setup()
    Hydrate.setServerRunner(() => Promise.reject(new Error('runtime down')))
    vi.stubGlobal('window', undefined)
    await expect(html(<LayerProvider provide={[]}><Show id="e" /></LayerProvider>)).rejects.toThrow('runtime down')
  })

  it('an opted-in failure renders on the server and on the client first paint', async () => {
    const calls = { n: 0 }
    const q = Hydrate.hydratable(
      Query.make({ key: (id: string) => ['bad', id], fetch: (): Effect.Effect<string, 'nope'> => Effect.suspend(() => { calls.n++; return Effect.fail('nope' as const) }) }),
      { value: Schema.String, error: Schema.Literal('nope') },
    )
    const state = await Effect.runPromise(Hydrate.prefetch([q('f')], { failures: true }) as Effect.Effect<Hydrate.Dehydrated>)
    const Show = () => { const { error } = useQuery(q('f')); return <i>{`err:${String(error)}`}</i> }
    const tree = <LayerProvider provide={[]}><Suspense fallback="loading"><HydrateQueries state={state}><Show /></HydrateQueries></Suspense></LayerProvider>
    vi.stubGlobal('window', undefined)
    const out = await html(tree)
    vi.unstubAllGlobals()
    expect(out).toContain('err:nope')
    render(tree)
    expect(await screen.findByText('err:nope')).toBeTruthy()
  })
})
