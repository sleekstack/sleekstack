import { Atom, type AtomStore, Result } from '@sleekstack/core'
import { SlotMismatch, useAtomValue } from '@sleekstack/ui'
import { Collector, Frame, missingStore, Store, takeSlot } from '@sleekstack/ui/internal'
import { Cause, Context, Deferred, Effect, FiberId, Option, type ParseResult, type Schema, Scope } from 'effect'
import { slotOf } from './registry'

let last = 0
/** A strictly increasing time in ms: a request's start, or a save's acknowledgement (a slot's `ackedAt`). */
export const stamp = (): number => (last = Math.max(Date.now(), last + 1))

/**
 * Writes `record` into the slot of `type` and `id`, unless a save was acknowledged at or after `startedAt` (the stamp
 * of the request that fetched it): that response is older than the acknowledgement, so it is dropped. Returns the
 * slot's value after.
 */
export const ingest = <A>(store: AtomStore, type: string, id: string, record: A, startedAt = Infinity): A => {
  const slot = slotOf(store, type, id)
  const { ackedAt, value } = store.get(slot)
  if (Option.isSome(ackedAt) && ackedAt.value >= startedAt) return Option.getOrElse(value, () => record) as A
  store.update(slot, (s) => ({ ...s, value: Option.some(record) }))
  return record
}

/**
 * What a record's adapter Service implements: the wire contract of one record type. `find` returns the record's wire
 * form (its fields' Encoded type) with any response envelope already removed; `save` sends a change and returns the
 * saved record's wire form. Failures are typed in `E`. The app declares the Tag (`Effect.Tag`) and supplies its Layer.
 */
export interface RecordAdapter<W, C = any, E = any> {
  readonly find: (id: string) => Effect.Effect<W, E>
  readonly save: (id: string, change: C) => Effect.Effect<W, E>
}

/** An adapter Tag whose Service reads and writes the wire form `W`. */
export type AdapterTag<W = any> = Context.Tag<any, RecordAdapter<W>>

/** The failure of the adapter's `find`. */
export type FindError<Ad extends AdapterTag> = Effect.Effect.Error<ReturnType<Context.Tag.Service<Ad>['find']>>

// One per Store: the in-flight `find` of each type and id, and a scope owning their fibers. The scope is the build scope
// of an Effect atom, so `dispose` closes it and waits for the interrupted calls' cleanup. A finished call leaves the map,
// so a failure is not reused.
interface InFlight {
  readonly calls: Map<string, Deferred.Deferred<any, any>>
  readonly scope: Scope.Scope
}
const inFlight = Atom.keepAlive(Atom.make(Effect.map(Effect.scope, (scope): InFlight => ({ calls: new Map(), scope }))))

/**
 * The `find` of record type `type`: the adapter's `find`, then `decode`, then a write into the map unless a save was
 * acknowledged after the request started. Concurrent calls for one id in a Store share one adapter call. The call runs
 * under the Store's scope: disposing the Store interrupts it, and nothing is written.
 */
export const findOf =
  <A, E, R>(
    type: string,
    adapter: AdapterTag,
    decode: (wire: unknown) => Effect.Effect<A, ParseResult.ParseError, R>,
  ) =>
  (id: string): Effect.Effect<A, E | ParseResult.ParseError, R | Store> =>
    Effect.flatMap(Store, (s) => {
      const built = s.get(inFlight)
      // The build is synchronous; only an inert Store (server rendering) leaves it unbuilt.
      if (!Result.isSuccess(built)) return Effect.dieMessage(`find('${id}') of '${type}' needs a live Store`)
      const own = built.value
      const key = JSON.stringify([type, id])
      const running = own.calls.get(key)
      if (running) return Deferred.await(running)
      const call = Deferred.unsafeMake<A, E | ParseResult.ParseError>(FiberId.none)
      own.calls.set(key, call)
      const startedAt = stamp()
      const work = adapter.pipe(
        Effect.flatMap((a) => a.find(id) as Effect.Effect<unknown, E>),
        Effect.flatMap(decode),
        Effect.map((record) => ingest(s, type, (record as { readonly id: string }).id, record, startedAt)),
        Effect.onExit((exit) =>
          Effect.suspend(() => {
            if (own.calls.get(key) === call) own.calls.delete(key)
            return Deferred.done(call, exit)
          }),
        ),
      )
      return Effect.zipRight(Effect.forkIn(work, own.scope), Deferred.await(call))
    })

/**
 * How `useRecord` loads a record into the map: `fetch(id)` ingests it, and `useRecord` reads the map. The default is the
 * record's own `find`; `queryOf(record)` from `@sleekstack/model/query` runs it through the Query Client.
 */
export interface FetchStrategy<E = unknown, R = never> {
  readonly fetch: (id: string) => Effect.Effect<unknown, E, R>
}

// A slot's fetch atom: one per type and id, built with the first run's context and retained while the slot holds it.
interface Fetch {
  readonly key: string
  readonly atom: Atom.Atom<Result.Result<unknown, unknown>>
  readonly release: () => void
  read: boolean
}

const resultOf = (
  value: Option.Option<unknown>,
  fetched: Result.Result<unknown, unknown> | undefined,
  what: string,
): Result.Result<unknown, unknown> => {
  if (Option.isSome(value)) return Result.success(value.value, { waiting: fetched?.waiting ?? false })
  if (fetched === undefined || Result.isInitial(fetched)) return Result.initial(true)
  if (Result.isFailure(fetched)) return Result.failure(fetched.cause, { waiting: fetched.waiting })
  return Result.failure(Cause.die(new Error(`useRecord: ${what} was fetched, but its slot in the map is empty`)))
}

// What `useRecord` reads of a record type; `RecordDefinition` itself is not assignable to a wider one (`push` takes its wire).
interface RecordLike {
  readonly type: string
  readonly schema: Schema.Schema.Any
  readonly atom: (id: string) => Atom.Atom<Option.Option<unknown>>
}
type TypeOf<D extends RecordLike> = Schema.Schema.Type<D['schema']>

/**
 * `useRecord(record, id, options?)`: the record `id` from the map, as a `Result`. When the map has no record for `id`,
 * it fetches it once (the record's own `find`, or `options.via`): `Initial` (waiting) on first load, then `Success` with
 * the map's value, or a `Failure` with the fetch's typed error. The map is the source of truth: a record in it is a
 * `Success` whatever the fetch does, so a refetch keeps showing it. A fetch that succeeds without filling the slot (the
 * adapter returned another id) is a defect.
 *
 * Takes a slot like `useLocal`, so call it unconditionally. Outside a component it reads the map and, when the record is
 * missing, starts a fetch whose atom nothing retains.
 */
export function useRecord<D extends RecordLike & { readonly find: (id: string) => Effect.Effect<any, any, any> }>(
  record: D,
  id: string,
): Effect.Effect<
  Result.Result<TypeOf<D>, Effect.Effect.Error<ReturnType<D['find']>>>,
  never,
  Store | Effect.Effect.Context<ReturnType<D['find']>>
>
export function useRecord<D extends RecordLike, E, R>(
  record: D,
  id: string,
  options: { readonly via: FetchStrategy<E, R> },
): Effect.Effect<Result.Result<TypeOf<D>, E>, never, Store | R>
export function useRecord(
  record: RecordLike & { readonly find?: FetchStrategy['fetch'] },
  id: string,
  options?: { readonly via: FetchStrategy<unknown, unknown> },
): Effect.Effect<Result.Result<unknown, unknown>, never, unknown> {
  return Effect.flatMap(Effect.context<never>(), (ctx) => {
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useRecord')
    const s = so.value
    const what = `'${record.type}' '${id}'`
    const fetchAtom = () => {
      const fetch = options?.via.fetch ?? record.find!
      return Atom.make(Effect.provide(fetch(id), ctx)) as Atom.Atom<Result.Result<unknown, unknown>>
    }
    const f = Context.get(ctx, Frame)
    if (Context.get(ctx, Collector) === undefined || f === undefined) {
      const fetched = Option.isNone(s.get(record.atom(id))) ? s.get(fetchAtom()) : undefined
      return Effect.succeed(resultOf(s.get(record.atom(id)), fetched, what))
    }
    const taken = takeSlot(f)
    if (taken instanceof SlotMismatch) return Effect.fail(taken) as unknown as Effect.Effect<never>
    if (taken.first) {
      const box: { current?: Fetch } = {}
      // The slot atom only holds the box, as `useRef`'s does; the fetch atom is retained for the slot's life.
      f.owner.atoms.push(Atom.make(box) as unknown as Atom.Writable<any>)
      f.owner.releases.push(() => box.current?.release())
    }
    const box = s.get(f.owner.atoms[taken.i] as unknown as Atom.Atom<{ current?: Fetch }>)
    const key = JSON.stringify([record.type, id])
    if (box.current?.key !== key) {
      box.current?.release()
      const atom = fetchAtom()
      box.current = { key, atom, release: s.retain(atom), read: false }
    }
    const fetch = box.current
    return Effect.flatMap(useAtomValue(record.atom(id)), (value) => {
      // Fetch only for an empty slot; once fetched, keep reading it so a refetch shows as `waiting`.
      if (Option.isSome(value) && !fetch.read) return Effect.succeed(resultOf(value, undefined, what))
      fetch.read = true
      // A synchronous fetch fills the map while it is read: read the map again after it.
      return Effect.map(useAtomValue(fetch.atom), (fetched) => resultOf(s.get(record.atom(id)), fetched, what))
    })
  })
}
