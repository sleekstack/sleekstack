import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { makeAtomStore } from '@sleekstack/core'
import { Query, QueryEvents } from '../index'

afterEach(() => { QueryEvents.clear(); vi.unstubAllEnvs(); vi.useRealTimers() })

const ev = (kind: QueryEvents.QueryEventKind, at: number): QueryEvents.QueryEvent =>
  ({ at, kind, key: `k${at}`, state: kind, observers: 0, updatedAt: undefined, gcTime: 0 })

describe('QueryEvents', () => {
  it('caps per kind: refetch chatter never evicts other kinds', () => {
    QueryEvents.record(ev('success', 0))
    QueryEvents.record(ev('added', 1))
    for (let i = 2; i < 2 + QueryEvents.CAP_PER_KIND * 3; i++) QueryEvents.record(ev('fetching', i))
    const all = QueryEvents.events()
    expect(all.filter((e) => e.kind === 'fetching')).toHaveLength(QueryEvents.CAP_PER_KIND)
    expect(all.slice(0, 2).map((e) => e.kind)).toEqual(['success', 'added'])
  })

  it('records nothing in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    QueryEvents.record(ev('success', 0))
    expect(QueryEvents.events()).toHaveLength(0)
  })

  it('the query lifecycle records added, fetching, success, failure and removed as they happen', async () => {
    vi.useFakeTimers()
    let fail = false
    const q = Query.make({ key: (id: string) => ['todo', id], fetch: (id) => (fail ? Effect.fail('boom') : Effect.succeed(id)), gcTime: '1 second' })
    const store = makeAtomStore()
    expect(QueryEvents.snapshot(store)).toEqual([])
    const release = Query.observe(store, q('a'))
    const [row] = QueryEvents.snapshot(store)
    expect(row).toMatchObject({ key: '["todo","a"]', state: 'Success', observers: 1, gcTime: 1000 })
    expect(row!.updatedAt).toBeTypeOf('number')
    // refetches between any two panel polls are still recorded: the buffer does not depend on sampling
    store.refresh(q('a'))
    fail = true
    store.refresh(q('a'))
    release()
    await vi.advanceTimersByTimeAsync(2000)
    expect(QueryEvents.events().map((e) => e.kind)).toEqual(['added', 'fetching', 'success', 'fetching', 'success', 'fetching', 'failure', 'removed'])
    vi.useRealTimers()
  })
})
