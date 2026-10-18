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
import { type Context, Effect, Option, type ParseResult, Schema } from 'effect'
import { type AdapterTag, type FetchStrategy, type FindError, ingest } from './adapter'
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
 * `queryOf(record)`: the record's query binding. The query function runs `record.find(id)` with `effectFn`, so with
 * the services of the Query Client Layer: provide the Store and the adapter Layer to that Layer (the same Store the
 * app reads), or the read fails with a defect naming the missing Tag. The entry caches the record's wire form; a
 * dehydrated entry must hold it too.
 *
 * Every read writes the entry's record into the map, a cache hit and a hydrated entry included, unless the record's
 * last save was acknowledged at or after the entry's `dataUpdatedAt` (an entry older than a save never overwrites
 * it). Once read in a Store, each later save's acknowledged record is written into the entry.
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
  const decode = Schema.decodeUnknown(record.schema)
  const encode = Schema.encode(record.schema)

  const queryFn = (id: string) =>
    effectFn(
      record.find(id).pipe(
        Effect.flatMap((found) => Effect.tap(encode(found), (wire) => void decoded.set(wire, found))),
        Effect.catchAllDefect((d) => Effect.fail(new Defect(d))),
      ),
    )

  // Runs the query, counting its waiters so that only the last interrupted one cancels the shared fetch (its signal
  // interrupts the query function's fiber).
  const run = (client: QueryClient, id: string) =>
    Effect.async<Wire, FindError<Ad> | ParseResult.ParseError>((resume) => {
      const queryKey = [record.type, id]
      const hash = JSON.stringify(queryKey)
      let counts = waiting.get(client)
      if (!counts) waiting.set(client, (counts = new Map()))
      const waiters = counts
      waiters.set(hash, (waiters.get(hash) ?? 0) + 1)
      const leave = () => {
        const n = waiters.get(hash)! - 1
        if (n === 0) waiters.delete(hash)
        else waiters.set(hash, n)
        return n
      }
      client.query({ queryKey, queryFn: queryFn(id) }).then(
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
    let ids = byClient.get(client)
    if (!ids) byClient.set(client, (ids = new Set()))
    if (ids.has(id)) return
    ids.add(id)
    const slot = slotOf(store, record.type, id)
    let acked = store.get(slot).ackedAt
    store.subscribe(slot, () => {
      const { ackedAt, value } = store.get(slot)
      if (Option.isNone(ackedAt) || Option.isNone(value) || ackedAt.value === Option.getOrUndefined(acked)) return
      acked = ackedAt
      const queryKey = [record.type, id]
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
      const wire = yield* run(client, id)
      const updatedAt = client.getQueryState([record.type, id])?.dataUpdatedAt ?? 0
      const found = (decoded.get(wire) as A | undefined) ?? (yield* decode(wire))
      const current = store.get(slotOf(store, record.type, id)).value
      if (Option.isSome(current) && current.value === found) return found
      return ingest(store, record.type, id, found, updatedAt)
    })

  return { query, fetch: query }
}
