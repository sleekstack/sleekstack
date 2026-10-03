/**
 * packages/react/src/__tests__/query.test.tsx
 *
 * Query hooks (fn-12 task .5, R8): StrictMode, store placement, suspense opt-in.
 */
import { afterEach, describe, it, expect } from 'vitest'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import React, { Component, Suspense, type ReactNode } from 'react'
import { Cause, Effect, Exit } from 'effect'
import { Mutation, Query } from '@sleekstack/query'
import { renderStrict } from './renderStrict'
import { LayerProvider, QueryProvider, useMutation, useQueries, useQuery, useQuerySuspense } from '../index'

afterEach(cleanup)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class Boundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) { return { error } }
  render() { return this.state.error ? <div data-testid="error">{String(this.state.error)}</div> : this.props.children }
}

const counted = (fail?: () => boolean) => {
  const calls = { n: 0 }
  const q = Query.make({
    key: (id: string) => ['item', id],
    fetch: (id) => Effect.suspend(() => {
      const n = ++calls.n
      return Effect.zipRight(Effect.sleep('10 millis'), fail?.() ? Effect.fail('boom' as const) : Effect.succeed(`${id}#${n}`))
    }),
  })
  return { q, calls }
}

describe('useQuery / useMutation', () => {
  it('StrictMode double mount performs one fetch and one onMutate', async () => {
    const { q, calls } = counted()
    let onMutate = 0
    const m = Mutation.make({ run: (_: string) => Effect.void, onMutate: () => Effect.sync(() => { onMutate++ }) })
    let mutate!: (i: string) => Promise<Exit.Exit<void, never>>
    const View = () => {
      const { data } = useQuery(q('a'))
      mutate = useMutation(m).mutate
      return <span data-testid="v">{data ?? 'loading'}</span>
    }
    renderStrict(<LayerProvider provide={[]}><Suspense fallback={null}><View /></Suspense></LayerProvider>)
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('a#1'))
    await act(async () => { expect(Exit.isSuccess(await mutate('x'))).toBe(true) })
    expect(calls.n).toBe(1)
    expect(onMutate).toBe(1)
  })

  it('nested providers share one query store; invalidate from a child reaches the parent entry', async () => {
    const { q, calls } = counted()
    let invalidate!: () => void
    const Parent = () => <span data-testid="p">{useQuery(q('a')).data ?? 'loading'}</span>
    const Child = () => { const queries = useQueries(); invalidate = () => queries.invalidate({ prefix: ['item'] }); return <span data-testid="c">{useQuery(q('a')).data ?? 'loading'}</span> }
    renderStrict(
      <LayerProvider provide={[]}><Suspense fallback={null}><Parent />
        <LayerProvider provide={[]}><Suspense fallback={null}><Child /></Suspense></LayerProvider>
      </Suspense></LayerProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('c').textContent).toBe('a#1'))
    expect(screen.getByTestId('p').textContent).toBe('a#1')
    expect(calls.n).toBe(1)
    act(() => invalidate())
    await waitFor(() => expect(screen.getByTestId('p').textContent).toBe('a#2'))
    expect(screen.getByTestId('c').textContent).toBe('a#2')
  })

  it('QueryProvider scopes the query store to its provider', async () => {
    const { q, calls } = counted()
    const View = ({ id }: { id: string }) => <span data-testid={id}>{useQuery(q('a')).data ?? 'loading'}</span>
    renderStrict(
      <LayerProvider provide={[]}><Suspense fallback={null}><View id="root" />
        <LayerProvider provide={[]}><QueryProvider><Suspense fallback={null}><View id="own" /></Suspense></QueryProvider></LayerProvider>
      </Suspense></LayerProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('own').textContent).not.toBe('loading'))
    await waitFor(() => expect(screen.getByTestId('root').textContent).not.toBe('loading'))
    expect(calls.n).toBe(2)
  })

  it('useQuerySuspense suspends only on Initial; refetch never suspends; failure keeps stale data plus error', async () => {
    let failing = false
    const { q } = counted(() => failing)
    let fallbacks = 0
    const Fallback = () => { fallbacks++; return <span data-testid="fallback" /> }
    let refetch!: () => void
    const View = () => {
      const r = useQuerySuspense(q('a'))
      refetch = r.refetch
      return <span data-testid="v">{`${r.data}|${r.error ?? ''}|${r.isFetching}`}</span>
    }
    renderStrict(<LayerProvider provide={[]}><Boundary><Suspense fallback={<Fallback />}><View /></Suspense></Boundary></LayerProvider>)
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('a#1||false'))
    const seen = fallbacks
    failing = true
    act(() => refetch())
    expect(screen.getByTestId('v').textContent).toBe('a#1||true')
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('a#1|boom|false'))
    expect(fallbacks).toBe(seen)
    expect(screen.queryByTestId('error')).toBeNull()
  })

  it.each([
    ['success', Effect.succeed('ok'), 'v', 'ok'],
    ['failure', Effect.fail('bad'), 'error', 'bad'],
  ] as const)('useQuerySuspense settles a synchronous %s', async (_, effect, id, text) => {
    const q = Query.make({ key: () => ['sync', _], fetch: () => effect as Effect.Effect<string, string> })
    const View = () => <span data-testid="v">{useQuerySuspense(q(undefined)).data}</span>
    renderStrict(<LayerProvider provide={[]}><Boundary><Suspense fallback={null}><View /></Suspense></Boundary></LayerProvider>)
    await waitFor(() => expect(screen.getByTestId(id).textContent).toBe(text))
  })

  it('a real remount of a stale query refetches', async () => {
    const { q, calls } = counted()
    const View = () => <span data-testid="v">{useQuery(q('a')).data ?? 'loading'}</span>
    let show!: (b: boolean) => void
    const Toggle = () => { const [on, set] = React.useState(true); show = set; return on ? <View /> : null }
    renderStrict(<LayerProvider provide={[]}><Suspense fallback={null}><Toggle /></Suspense></LayerProvider>)
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('a#1'))
    act(() => show(false))
    await act(() => sleep(5))
    act(() => show(true))
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('a#2'))
    expect(calls.n).toBe(2)
  })

  it('a defect beside a typed failure goes to the error boundary', async () => {
    const q = Query.make({ key: () => ['mixed'], fetch: () => Effect.failCause(Cause.parallel(Cause.fail('typed'), Cause.die(new Error('defect')))) })
    const View = () => <span data-testid="v">{String(useQuery(q(undefined)).error)}</span>
    renderStrict(<LayerProvider provide={[]}><Boundary><Suspense fallback={null}><View /></Suspense></Boundary></LayerProvider>)
    await waitFor(() => expect(screen.getByTestId('error').textContent).toContain('defect'))
  })
})
