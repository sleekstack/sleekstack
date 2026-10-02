import { describe, expect, it, vi } from 'vitest'
import { Cause, Effect, Option } from 'effect'
import { makeAtomStore, Result } from '@sleekstack/core'
import { Query } from '../index'

const pages = (store: ReturnType<typeof makeAtomStore>, atom: Query.InfiniteQueryAtom<number, number, unknown>) =>
  Option.getOrUndefined(Result.value(store.get(atom)))

describe('Query.infinite', () => {
  const setup = (opts: { maxPages?: number; failAt?: number } = {}) => {
    const fetched: number[] = []
    let offset = 0
    const q = Query.infinite({
      key: () => ['list', Math.random()],
      initialParam: 0,
      fetchPage: (_: undefined, p: number) =>
        Effect.suspend(() => { fetched.push(p); return p === opts.failAt ? Effect.fail('boom' as const) : Effect.succeed(p * 10 + offset) }),
      getNextParam: (_, d) => d.pageParams[d.pageParams.length - 1]! + 1,
      getPreviousParam: (_, d) => d.pageParams[0]! - 1,
      maxPages: opts.maxPages,
    })
    return { q: q(undefined), fetched, bump: () => { offset++ } }
  }

  it('fetches next and previous pages', () => {
    const { q } = setup()
    const store = makeAtomStore()
    store.get(q)
    Query.fetchNext(store, q)
    Query.fetchPrevious(store, q)
    expect(pages(store, q)).toEqual({ pages: [-10, 0, 10], pageParams: [-1, 0, 1] })
  })

  it('maxPages drops pages from the opposite end', () => {
    const { q } = setup({ maxPages: 2 })
    const store = makeAtomStore()
    store.get(q)
    Query.fetchNext(store, q)
    Query.fetchNext(store, q)
    expect(pages(store, q)).toEqual({ pages: [10, 20], pageParams: [1, 2] })
    Query.fetchPrevious(store, q)
    expect(pages(store, q)).toEqual({ pages: [0, 10], pageParams: [0, 1] })
  })

  it('refetch re-runs loaded pages sequentially from the first', () => {
    const { q, fetched, bump } = setup()
    const store = makeAtomStore()
    store.get(q)
    Query.fetchNext(store, q)
    fetched.length = 0
    bump()
    store.refresh(q)
    expect(pages(store, q)).toEqual({ pages: [1, 11], pageParams: [0, 1] })
    expect(fetched).toEqual([0, 1])
  })

  it('a failing page keeps prior pages and reports the failure', () => {
    const { q } = setup({ failAt: 2 })
    const store = makeAtomStore()
    store.get(q)
    Query.fetchNext(store, q)
    Query.fetchNext(store, q)
    const r = store.get(q)
    expect(Result.isFailure(r) && Option.getOrUndefined(Cause.failureOption(r.cause))).toBe('boom')
    expect(pages(store, q)).toEqual({ pages: [0, 10], pageParams: [0, 1] })
  })

  it('is a no-op before the first page is built', () => {
    const { q, fetched } = setup()
    const store = makeAtomStore()
    Query.fetchNext(store, q)
    expect(fetched).toEqual([])
  })

  it('isFetchingNext is set only while a next page loads', async () => {
    vi.useFakeTimers()
    try {
      const q = Query.infinite({
        key: () => ['slow'],
        initialParam: 0,
        fetchPage: (_: undefined, p: number) => Effect.delay(Effect.succeed(p), '10 millis'),
        getNextParam: (last) => last + 1,
      })(undefined)
      const store = makeAtomStore()
      const seen: boolean[] = []
      const unsub = store.subscribe(q, () => { seen.push(Query.isFetchingNext(store, q)) })
      await vi.advanceTimersByTimeAsync(10)
      seen.length = 0
      Query.fetchNext(store, q)
      expect(seen).toEqual([true])
      expect([Query.isFetchingNext(store, q), Query.isFetchingPrevious(store, q)]).toEqual([true, false])
      await vi.advanceTimersByTimeAsync(10)
      expect(Query.isFetchingNext(store, q)).toBe(false)
      store.refresh(q)
      expect(store.get(q).waiting && Query.isFetchingNext(store, q)).toBe(false)
      unsub()
    } finally { vi.useRealTimers() }
  })
})
