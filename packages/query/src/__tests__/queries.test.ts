import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect, Option, Schedule } from 'effect'
import { makeAtomStore } from '@sleekstack/core'
import { Queries, Query } from '../index'

afterEach(() => { vi.useRealTimers() })

const counted = () => {
  const calls: string[] = []
  const q = Query.make({
    key: (k: ReadonlyArray<string>) => k,
    fetch: (k) => Effect.sync(() => { calls.push(k.join('/')); return calls.length }).pipe(Effect.delay('1 millis')),
    staleTime: '1 hour',
  })
  return { q, calls }
}

describe('Queries', () => {
  it.each([
    ['prefix', { prefix: ['todo'] }],
    ['predicate', { predicate: (e: Query.QueryEntry) => e.tuple[0] === 'todo' }],
  ])('invalidate by %s refetches observed matches only and marks unobserved ones stale', async (_, filter) => {
    vi.useFakeTimers()
    const { q, calls } = counted()
    const store = makeAtomStore()
    const client = Queries.make(store)
    const a = Query.observe(store, q(['todo', '1']))
    Query.observe(store, q(['todo', '2']))()
    const other = Query.observe(store, q(['user', '1']))
    await vi.advanceTimersByTimeAsync(1)
    calls.length = 0
    client.invalidate(filter)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['todo/1'])
    // the unobserved match is stale now: a new observer refetches despite staleTime
    const b = Query.observe(store, q(['todo', '2']))
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['todo/1', 'todo/2'])
    a(); b(); other()
  })

  it('refetch forces a fetch of every match', async () => {
    vi.useFakeTimers()
    const { q, calls } = counted()
    const store = makeAtomStore()
    const release = Query.observe(store, q(['todo', '1']))
    await vi.advanceTimersByTimeAsync(1)
    Queries.make(store).refetch(q(['todo', '1']))
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['todo/1', 'todo/1'])
    release()
  })

  it('setData on a missing key creates the entry without fetching; getData on a missing key is none', async () => {
    vi.useFakeTimers()
    const { q, calls } = counted()
    const store = makeAtomStore()
    const client = Queries.make(store)
    expect(client.getData(q(['todo', '9']))).toEqual(Option.none())
    expect(Query.entries(store).size).toBe(0)
    client.setData(q(['todo', '9']), 5)
    client.updateData(q(['todo', '9']), (prev: Option.Option<number>) => Option.getOrElse(prev, () => 0) + 1)
    expect(client.getData(q(['todo', '9']))).toEqual(Option.some(6))
    expect(store.get(q(['todo', '9']))).toMatchObject({ _tag: 'Success', value: 6, waiting: false })
    expect(Query.entries(store).has(q(['todo', '9'])[Query.TypeId].id)).toBe(true)
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toEqual([])
    expect(client.getData(q(['todo', '9']))).toEqual(Option.some(6))
  })

  it('setData during an in-flight fetch stays authoritative', async () => {
    vi.useFakeTimers()
    const { q } = counted()
    const store = makeAtomStore()
    const release = Query.observe(store, q(['todo', '1']))
    Queries.make(store).setData(q(['todo', '1']), 42)
    await vi.advanceTimersByTimeAsync(10)
    expect(store.get(q(['todo', '1']))).toMatchObject({ _tag: 'Success', value: 42, waiting: false })
    release()
  })

  it('invalidating an unobserved query with a fetch in flight keeps it stale', async () => {
    vi.useFakeTimers()
    const { q, calls } = counted()
    const store = makeAtomStore()
    store.get(q(['todo', '1']))
    Queries.make(store).invalidate({ prefix: ['todo'] })
    await vi.advanceTimersByTimeAsync(10)
    calls.length = 0
    const release = Query.observe(store, q(['todo', '1']))
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['todo/1'])
    release()
  })

  it('cancel during a retry stops the schedule and keeps the previous value', async () => {
    vi.useFakeTimers()
    let attempts = 0
    let fail = false
    const q = Query.make({
      key: () => ['r'],
      fetch: () => Effect.suspend(() => { attempts++; return fail ? Effect.fail('boom') : Effect.succeed(attempts) }),
      retry: Schedule.spaced('10 millis'),
    })
    const store = makeAtomStore()
    const release = Query.observe(store, q(undefined))
    await vi.advanceTimersByTimeAsync(0)
    fail = true
    store.refresh(q(undefined))
    await vi.advanceTimersByTimeAsync(25)
    expect(attempts).toBe(4)
    Queries.make(store).cancel({ prefix: ['r'] })
    await vi.advanceTimersByTimeAsync(100)
    expect(attempts).toBe(4)
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 1, waiting: false })
    release()
  })

  it('reset restores Initial: an observed query refetches from Initial, an unobserved one drops its entry without fetching', async () => {
    vi.useFakeTimers()
    const { q, calls } = counted()
    const store = makeAtomStore()
    const client = Queries.make(store)
    const release = Query.observe(store, q(['todo', '1']))
    Query.observe(store, q(['todo', '2']))()
    await vi.advanceTimersByTimeAsync(1)
    client.reset({ prefix: ['todo'] })
    expect(store.get(q(['todo', '1']))).toMatchObject({ _tag: 'Initial', waiting: true })
    expect(Query.entries(store).has(q(['todo', '2'])[Query.TypeId].id)).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['todo/1', 'todo/2', 'todo/1'])
    expect(store.get(q(['todo', '1']))).toMatchObject({ _tag: 'Success', value: 3 })
    const again = Query.observe(store, q(['todo', '2']))
    expect(store.get(q(['todo', '2']))).toMatchObject({ _tag: 'Initial', waiting: true })
    again(); release()
  })
})
