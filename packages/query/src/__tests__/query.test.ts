import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cause, Context, Effect, Option, Schedule, Stream } from 'effect'
import { atomStoreFor, makeAppScope, makeAtomStore, Result } from '@sleekstack/core'
import { canonicalKey, InvalidQueryKey, Query } from '../index'

const flush = () => vi.advanceTimersByTimeAsync(0)
const failureOf = (r: Result.Result<unknown, unknown>) => (Result.isFailure(r) ? Option.getOrUndefined(Cause.failureOption(r.cause)) : undefined)

afterEach(() => { vi.useRealTimers() })

describe('keys', () => {
  it('canonicalizes: equal fresh tuples and reordered objects hit one atom', () => {
    const q = Query.make({ key: (a: { id: number; tag: string }) => ['todo', a], fetch: () => Effect.succeed(1) })
    expect(q({ id: 1, tag: 'x' })).toBe(q({ tag: 'x', id: 1 }))
    expect(q({ id: 1, tag: 'x' })).not.toBe(q({ id: 2, tag: 'x' }))
    const shared = { a: 1 }
    expect(canonicalKey([shared, shared])).toBe('[{"a":1},{"a":1}]')
    expect(canonicalKey([new Array(1)])).toBe('[[null]]')
    expect(canonicalKey([new Date(0)])).not.toBe(canonicalKey([new Date(1)]))
  })

  it.each([
    ['function', [() => 1]],
    ['bigint', [1n]],
    ['symbol', [Symbol('s')]],
    ['cycle', (() => { const a: unknown[] = []; a.push(a); return a })()],
  ])('throws InvalidQueryKey for a %s', (_, key) => {
    const q = Query.make({ key: () => key as unknown[], fetch: () => Effect.succeed(1) })
    expect(() => q(undefined)).toThrow(InvalidQueryKey)
  })
})

describe('Query.make', () => {
  it('concurrent reads share one fetch', async () => {
    vi.useFakeTimers()
    let calls = 0
    const q = Query.make({ key: (id: string) => ['t', id], fetch: (id) => Effect.sync(() => calls++).pipe(Effect.delay('10 millis'), Effect.as(id)) })
    const store = makeAtomStore()
    const a = Query.observe(store, q('1'))
    const b = Query.observe(store, q('1'))
    expect(store.get(q('1'))).toMatchObject({ _tag: 'Initial', waiting: true })
    await vi.advanceTimersByTimeAsync(10)
    expect(store.get(q('1'))).toMatchObject({ _tag: 'Success', value: '1' })
    expect(calls).toBe(1)
    a(); b()
  })

  it('staleTime skips the mount refetch while fresh, refetches once stale with waiting and the previous value', async () => {
    vi.useFakeTimers()
    let n = 0
    const q = Query.make({ key: () => ['n'], fetch: () => Effect.sync(() => ++n).pipe(Effect.delay('1 millis')), staleTime: '100 millis' })
    const store = makeAtomStore()
    const first = Query.observe(store, q(undefined))
    await vi.advanceTimersByTimeAsync(1)
    first()
    Query.observe(store, q(undefined))()
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 1, waiting: false })
    await vi.advanceTimersByTimeAsync(100)
    const release = Query.observe(store, q(undefined))
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 1, waiting: true })
    await vi.advanceTimersByTimeAsync(1)
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 2, waiting: false })
    release()
  })

  it('gcTime removes the node and interrupts the in-flight fetch after the last observer leaves', async () => {
    vi.useFakeTimers()
    let interrupted = false
    const q = Query.make({ key: () => ['gc'], fetch: () => Effect.onInterrupt(Effect.never, () => Effect.sync(() => { interrupted = true })), gcTime: '1 second' })
    const store = makeAtomStore()
    const release = Query.observe(store, q(undefined))
    await flush()
    release()
    await vi.advanceTimersByTimeAsync(500)
    expect(interrupted).toBe(false)
    const id = q(undefined)[Query.TypeId].id
    expect(Query.entries(store).has(id)).toBe(true)
    await vi.advanceTimersByTimeAsync(600)
    expect(interrupted).toBe(true)
    expect(Query.entries(store).has(id)).toBe(false)
  })

  it('retry re-runs typed failures only, and an interval refetch never overlaps a retry', async () => {
    vi.useFakeTimers()
    let calls = 0
    const q = Query.make({
      key: () => ['r'],
      fetch: () => Effect.suspend(() => (++calls < 3 ? Effect.fail('boom' as const) : Effect.succeed(calls))),
      retry: Schedule.spaced('40 millis'),
      refetchInterval: '30 millis',
    })
    const store = makeAtomStore()
    const release = Query.observe(store, q(undefined))
    await vi.advanceTimersByTimeAsync(85) // retries at 40 and 80; interval ticks at 30 and 60 are skipped
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 3 })
    expect(calls).toBe(3)
    await vi.advanceTimersByTimeAsync(30) // next tick refetches (forced, ignores staleTime)
    expect(calls).toBe(4)
    release()

    let defects = 0
    const d = Query.make({ key: () => ['d'], fetch: () => Effect.sync(() => { defects++; throw new Error('bug') }), retry: Schedule.recurs(3) })
    expect(Result.isFailure(store.get(d(undefined)))).toBe(true)
    expect(defects).toBe(1)
  })

  it('a failed fetch is a typed Failure; a missing service is MissingDependency', async () => {
    class Api extends Context.Tag('Api')<Api, number>() {}
    const store = atomStoreFor(await Effect.runPromise(makeAppScope([])))
    const failed = Query.make({ key: () => ['f'], fetch: () => Effect.fail({ _tag: 'NotFound' as const }) })
    expect(failureOf(store.get(failed(undefined)))).toEqual({ _tag: 'NotFound' })
    const missing = Query.make({ key: () => ['m'], fetch: () => Api })
    expect(failureOf(store.get(missing(undefined)))).toMatchObject({ _tag: 'MissingDependency', missing: 'Api' })
  })

  it('stale-gated refetchOn sources refetch only once stale; a write seeds a Success', async () => {
    vi.useFakeTimers()
    let n = 0
    const focus = Stream.fromIterable([1, 2]).pipe(Stream.schedule(Schedule.spaced('10 millis')))
    const q = Query.make({ key: () => ['s'], fetch: () => Effect.sync(() => ++n), staleTime: '15 millis', refetchOn: [focus] })
    const store = makeAtomStore()
    const release = Query.observe(store, q(undefined))
    expect(n).toBe(1)
    await vi.advanceTimersByTimeAsync(10) // first focus: still fresh
    expect(n).toBe(1)
    await vi.advanceTimersByTimeAsync(10) // second focus: stale
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 2 })
    store.set(q(undefined), 42)
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 42 })
    release()
  })
})

describe('registry and lifecycle', () => {
  it('two definitions with one key are separate entries', () => {
    const a = Query.make({ key: () => ['same'], fetch: () => Effect.succeed('a') })
    const b = Query.make({ key: () => ['same'], fetch: () => Effect.succeed('b') })
    const store = makeAtomStore()
    const ra = Query.observe(store, a(undefined))
    const rb = Query.observe(store, b(undefined))
    expect([...Query.entries(store).values()].map((e) => [e.key, e.observers])).toEqual([['["same"]', 1], ['["same"]', 1]])
    ra(); rb()
  })

  it('QueryCache is replaceable through the store context', () => {
    const registry = new Map<string, Query.QueryEntry>()
    const q = Query.make({ key: () => ['c'], fetch: () => Effect.succeed(1) })
    const store = makeAtomStore({ context: Context.make(Query.QueryCache, { registry }) })
    store.get(q(undefined))
    expect([...registry.values()].map((e) => e.key)).toEqual(['["c"]'])
  })

  it('disposing the store stops trigger fibers', async () => {
    vi.useFakeTimers()
    let n = 0
    const q = Query.make({ key: () => ['i'], fetch: () => Effect.sync(() => ++n), refetchInterval: '10 millis' })
    const store = makeAtomStore()
    Query.observe(store, q(undefined))
    await store.dispose()
    await vi.advanceTimersByTimeAsync(50)
    expect(n).toBe(1)
  })

  it('a Stream fetch is a live query', async () => {
    const q = Query.make({ key: () => ['live'], fetch: () => Stream.make(1, 2) })
    const store = makeAtomStore()
    const release = Query.observe(store, q(undefined))
    await new Promise((r) => setTimeout(r, 0))
    expect(store.get(q(undefined))).toMatchObject({ _tag: 'Success', value: 2 })
    release()
  })
})

it('the core has no DOM access', () => {
  const dir = join(import.meta.dirname, '..')
  for (const f of readdirSync(dir).filter((f: string) => f.endsWith('.ts'))) {
    expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/\b(window|document|navigator|addEventListener)\b/)
  }
})
