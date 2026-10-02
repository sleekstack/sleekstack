import { describe, expect, it } from 'vitest'
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
})
