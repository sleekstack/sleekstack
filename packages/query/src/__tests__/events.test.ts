import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { makeAtomStore } from '@sleekstack/core'
import { Query, QueryEvents } from '../index'

afterEach(() => { QueryEvents.clear(); vi.unstubAllEnvs() })

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

  it('sample records added, state changes and removal with key, observers, updatedAt and gc timer', async () => {
    const q = Query.make({ key: (id: string) => ['todo', id], fetch: (id) => Effect.succeed(id), gcTime: '1 second' })
    const store = makeAtomStore()
    expect(QueryEvents.sample(store)).toEqual([])
    const release = Query.observe(store, q('a'))
    const [row] = QueryEvents.sample(store)
    expect(row).toMatchObject({ key: '["todo","a"]', state: 'Success', observers: 1, gcTime: 1000 })
    expect(row!.updatedAt).toBeTypeOf('number')
    expect(QueryEvents.sample(store)).toHaveLength(1) // unchanged: no new event
    expect(QueryEvents.events().map((e) => e.kind)).toEqual(['added'])
    release()
    QueryEvents.sample(store)
    await store.dispose()
    QueryEvents.sample(store)
    expect(QueryEvents.events().map((e) => e.kind)).toEqual(['added', 'success', 'removed'])
  })
})
