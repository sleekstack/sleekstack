import { describe, expect, it, vi } from 'vitest'
import { Cause, Context, Data, Effect, Option } from 'effect'
import { atomStoreFor, makeAppScope, makeAtomStore, Result } from '@sleekstack/core'
import { Queries, Query } from '../index'

class Names extends Context.Tag('Names')<Names, { readonly get: (id: string) => string }>() {}
const dto = { id: 't1', projectId: 'p1' }
const fromDto = (d: typeof dto) => Effect.map(Names, (n) => ({ id: d.id, projectName: n.get(d.projectId) }))

describe('Query.select', () => {
  it('memoises on data identity per store; two stores yield different Models', () => {
    let selects = 0
    const q = Query.make({ key: () => ['s1'], fetch: () => Effect.succeed(dto) })
    const model = Query.select((d: typeof dto) => { selects++; return fromDto(d) })
    const a = makeAtomStore({ context: Context.make(Names, { get: () => 'Alpha' }) })
    const b = makeAtomStore({ context: Context.make(Names, { get: () => 'Beta' }) })
    expect(a.get(model(q(undefined)))).toMatchObject({ _tag: 'Success', value: { projectName: 'Alpha' } })
    expect(b.get(model(q(undefined)))).toMatchObject({ _tag: 'Success', value: { projectName: 'Beta' } })
    expect(selects).toBe(2)
    const unsub = a.subscribe(model(q(undefined)), () => {})
    a.refresh(q(undefined)) // refetch yields the same reference: no re-select
    a.get(model(q(undefined)))
    expect(selects).toBe(2)
    a.set(q(undefined), { ...dto })
    a.get(model(q(undefined)))
    expect(selects).toBe(3)
    unsub()
  })

  it('a pending re-select keeps the previous Model with waiting', async () => {
    vi.useFakeTimers()
    try {
      const q = Query.make({ key: () => ['s2'], fetch: () => Effect.succeed(dto) })
      const model = Query.select((d: typeof dto) => Effect.delay(fromDto(d), '10 millis'))
      const store = makeAtomStore({ context: Context.make(Names, { get: (id) => id.toUpperCase() }) })
      const unsub = store.subscribe(model(q(undefined)), () => {})
      await vi.advanceTimersByTimeAsync(10)
      expect(store.get(model(q(undefined)))).toMatchObject({ _tag: 'Success', waiting: false, value: { projectName: 'P1' } })
      store.set(q(undefined), { ...dto, projectId: 'p2' })
      expect(store.get(model(q(undefined)))).toMatchObject({ _tag: 'Success', waiting: true, value: { projectName: 'P1' } })
      await vi.advanceTimersByTimeAsync(10)
      expect(store.get(model(q(undefined)))).toMatchObject({ _tag: 'Success', waiting: false, value: { projectName: 'P2' } })
      unsub()
    } finally { vi.useRealTimers() }
  })

  it('a select needing an unprovided service yields the scope error', async () => {
    const store = atomStoreFor(await Effect.runPromise(makeAppScope([])))
    const q = Query.make({ key: () => ['s3'], fetch: () => Effect.succeed(dto) })
    const r = store.get(Query.select(fromDto)(q(undefined)))
    expect(Result.isFailure(r) && Option.getOrUndefined(Cause.failureOption(r.cause))).toMatchObject({ _tag: 'MissingDependency', missing: 'Names' })
  })

  it('memoises on reference, not structural equality', () => {
    let selects = 0
    const q = Query.make({ key: () => ['s4'], fetch: () => Effect.succeed(Data.struct({ n: 1 })) })
    const model = Query.select((d: { n: number }) => Effect.sync(() => ++selects + d.n))
    const store = makeAtomStore()
    const unsub = store.subscribe(model(q(undefined)), () => {})
    store.refresh(q(undefined)) // a new, Equal struct
    store.get(model(q(undefined)))
    expect(selects).toBe(2)
    unsub()
  })

  it('a failed refetch with cached data is a Failure keeping the previous Model', () => {
    let fail = false
    const q = Query.make({ key: () => ['s5'], fetch: () => Effect.suspend(() => (fail ? Effect.fail('down' as const) : Effect.succeed(dto))) })
    const model = Query.select(fromDto)
    const store = makeAtomStore({ context: Context.make(Names, { get: () => 'Alpha' }) })
    const unsub = store.subscribe(model(q(undefined)), () => {})
    fail = true
    Queries.make(store).refetch(q(undefined))
    const r = store.get(model(q(undefined)))
    expect(Result.isFailure(r) && Option.getOrUndefined(Cause.failureOption(r.cause))).toBe('down')
    expect(Option.getOrUndefined(Result.value(r))).toMatchObject({ projectName: 'Alpha' })
    unsub()
  })
})
