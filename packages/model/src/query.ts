/**
 * packages/model/src/query.ts
 *
 * `@sleekstack/model/query`: a record's `find` run through the Query Client, for caching, de-duping and stale handling.
 * The base entry never imports this file or `@sleekstack/query`.
 */
import type { AtomStore } from '@sleekstack/core'
import { effectFn, QueryClientTag } from '@sleekstack/query'
import { Store } from '@sleekstack/ui/internal'
import type { QueryClient } from '@tanstack/query-core'
import { type Context, Effect, Option, ParseResult, Schema } from 'effect'
import { type AdapterTag, type FetchStrategy, type FindError, ingest, stamp } from './adapter'
import type { AdaptedRecord, RecordFields } from './record'
import { slotOf } from './registry'

/**
 * A record's query binding (`queryOf(record)`). `query(id)` reads the entry `[type, id]` of the scope's `QueryClient`,
 * fetching it with the record's `find` when it is missing or stale, and writes the record into the map. It is also a
 * `FetchStrategy`: `useRecord(record, id, { via: queryOf(record) })`.
 */
export interface RecordQuery<A, E, R> extends FetchStrategy<E, R> {
  readonly query: (id: string) => Effect.Effect<A, E, R>
}

// A defect of the query function, kept apart from its typed failures (`effectFn` rejects with either).
class Defect {
  constructor(readonly defect: unknown) {}
}

// The record each query function decoded, by the wire it cached: a read of that entry writes nothing new.
const decoded = new WeakMap<object, unknown>()

// The `query(id)` calls waiting on each entry of a client: the last one interrupted cancels the fetch.
const waiting = new WeakMap<QueryClient, Map<string, number>>()

// The slots whose acknowledged saves a client's entries follow, per Store.
const following = new WeakMap<AtomStore, WeakMap<QueryClient, Set<string>>>()

/**
 * `queryOf(record)`: the record's query binding. The query function runs `find`'s steps (the adapter's `find`, the
 * fields' `hydrate`, a write into the map unless a save was acknowledged after the request started) with `effectFn`,
 * so with the services of the Query Client Layer: provide the Store and the adapter Layer to that Layer (the same Store the
 * app reads), or the read fails with a defect naming the missing Tag. The entry caches the record's wire form; a
 * dehydrated entry must hold it too.
 *
 * Every read writes the entry's record into the map, a cache hit and a hydrated entry included, unless the record's
 * last save was acknowledged at or after the entry's `dataUpdatedAt` (an entry older than a save never overwrites
 * it), and a record of another id is a `ParseError`. An evicted record whose entry is no newer than its last save is
 * fetched again. Cancelling the query (its last waiter interrupted) interrupts the adapter call. Once read in a Store, each later save's acknowledged record is written into the entry.
 */
export const queryOf = <T extends string, F extends RecordFields, Ad extends AdapterTag>(
  record: AdaptedRecord<T, F, Ad>,
): RecordQuery<
  Schema.Schema.Type<Schema.Struct<F>>,
  FindError<Ad> | ParseResult.ParseError,
  QueryClientTag | Store | Schema.Struct.Context<F>
> => {
  type A = Schema.Schema.Type<Schema.Struct<F>>
  type Wire = Schema.Struct.Encoded<F>
  type E = FindError<Ad> | ParseResult.ParseError
  const decode = Schema.decodeUnknown(record.schema)
  const encode = Schema.encode(record.schema)
  const keyOf = (id: string) => [record.type, id]
  // A wire of another record, under this id, would put that record in this id's slot.
  const checkId =
    (id: string, wire: unknown) =>
    (found: A): Effect.Effect<A, ParseResult.ParseError> =>
      (found as unknown as { readonly id: string }).id === id
        ? Effect.succeed(found)
        : Effect.fail(
            new ParseResult.ParseError({
              issue: new ParseResult.Type(Schema.Literal(id).ast, wire, `expected the record '${id}'`),
            }),
          )

  // `find`'s steps (adapter, hydrate, ingest unless a save was acknowledged after the request started), in the query
  // function's own fiber, so the query's abort signal interrupts the adapter call; the Query Client de-duplicates.
  // Caches the slot's record after it: an acknowledged save, when it dropped the response.
  const queryFn = (id: string) =>
    effectFn(
      Effect.gen(function* () {
        const store = yield* Store
        const startedAt = stamp()
        const adapter = yield* record.adapter as AdapterTag
        const wire = yield* adapter.find(id) as Effect.Effect<unknown, E>
        const found = yield* decode(wire).pipe(Effect.flatMap(checkId(id, wire)))
        const current = ingest(store, record.type, id, found, startedAt)
        return yield* Effect.tap(encode(current), (cached) => void decoded.set(cached, current))
      }).pipe(Effect.catchAllDefect((d) => Effect.fail(new Defect(d)))),
    )

  // Runs the query; the last of its waiters to be interrupted cancels the shared fetch.
  const run = (client: QueryClient, id: string, staleTime?: number) =>
    Effect.async<Wire, E>((resume) => {
      const queryKey = keyOf(id)
      const hash = JSON.stringify(queryKey)
      let counts = waiting.get(client)
      if (!counts) waiting.set(client, (counts = new Map()))
      const waiters = counts
      waiters.set(hash, (waiters.get(hash) ?? 0) + 1)
      let left = false
      // Once per call, whether it settles or is interrupted first: the count of waiters still on the fetch.
      const leave = () => {
        if (left) return -1
        left = true
        const n = waiters.get(hash)! - 1
        if (n === 0) waiters.delete(hash)
        else waiters.set(hash, n)
        return n
      }
      client.query({ queryKey, queryFn: queryFn(id), ...(staleTime !== undefined && { staleTime }) }).then(
        (wire) => (leave(), resume(Effect.succeed(wire as Wire))),
        (e) => (leave(), resume(e instanceof Defect ? Effect.die(e.defect) : Effect.fail(e))),
      )
      return Effect.sync(() => {
        if (leave() === 0) void client.cancelQueries({ queryKey, exact: true })
      })
    })

  // Writes each acknowledged save of the slot into the entry, dated by its acknowledgement.
  const follow = (
    store: AtomStore,
    client: QueryClient,
    id: string,
    ctx: Context.Context<Schema.Struct.Context<F>>,
  ) => {
    let byClient = following.get(store)
    if (!byClient) following.set(store, (byClient = new WeakMap()))
    let keys = byClient.get(client)
    if (!keys) byClient.set(client, (keys = new Set()))
    const queryKey = keyOf(id)
    const hash = JSON.stringify(queryKey)
    if (keys.has(hash)) return
    keys.add(hash)
    const slot = slotOf(store, record.type, id)
    let acked = store.get(slot).ackedAt
    store.subscribe(slot, () => {
      const { ackedAt, value } = store.get(slot)
      if (Option.isNone(ackedAt) || Option.isNone(value) || ackedAt.value === Option.getOrUndefined(acked)) return
      acked = ackedAt
      Effect.runFork(
        encode(value.value as A).pipe(
          Effect.map((wire) => {
            decoded.set(wire, value.value)
            client.setQueryData(queryKey, wire, { updatedAt: ackedAt.value })
          }),
          Effect.catchAll(() => Effect.sync(() => client.removeQueries({ queryKey, exact: true }))),
          Effect.provide(ctx),
        ),
      )
    })
  }

  const query = (id: string) =>
    Effect.gen(function* () {
      const client = yield* QueryClientTag
      const store = yield* Store
      const ctx = yield* Effect.context<Schema.Struct.Context<F>>()
      follow(store, client, id, ctx)
      const slot = slotOf(store, record.type, id)
      const before = store.get(slot)
      // An empty slot (evicted) with an entry no newer than its last acknowledgement: the entry cannot refill it, so fetch.
      const updatedBefore = client.getQueryState(keyOf(id))?.dataUpdatedAt ?? 0
      const refetch = Option.isNone(before.value) && Option.exists(before.ackedAt, (t) => updatedBefore <= t)
      const wire = yield* run(client, id, refetch ? 0 : undefined)
      const updatedAt = client.getQueryState(keyOf(id))?.dataUpdatedAt ?? 0
      const found =
        (decoded.get(wire) as A | undefined) ?? (yield* decode(wire).pipe(Effect.flatMap(checkId(id, wire))))
      const current = store.get(slot).value
      if (Option.isSome(current) && current.value === found) return found
      return ingest(store, record.type, id, found, updatedAt)
    })

  return { query, fetch: query }
}
