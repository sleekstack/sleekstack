/**
 * packages/query/src/query.ts
 *
 * `Query.make`: a keyed family of writable atoms on the native atom store. The read runs the fetch,
 * the write seeds data. A per-store registry (a keepAlive atom, so no AtomStore change) tracks
 * `updatedAt` and observers; staleness gates only triggers, never a mounted node by itself.
 */

import { Atom, Result, type AtomStore } from '@sleekstack/core'
import { Duration, Effect, Fiber, Schedule, Stream } from 'effect'
import { canonicalKey } from './key'

/** Brand carrying a query atom's policy. */
export const TypeId: unique symbol = Symbol.for('@sleekstack/query/Query') as never

/** A query's policy, read by `observe` and the registry. */
export interface QueryInfo {
  /** Canonical key string. */
  readonly key: string
  /** Registry id: the definition plus the canonical key (two definitions with one key are distinct entries). */
  readonly id: string
  /** The key tuple as returned by `key` (kept for prefix matching). */
  readonly tuple: ReadonlyArray<unknown>
  /** Milliseconds a fetched value stays fresh. */
  readonly staleTime: number
  /** Stale-gated refetch triggers. */
  readonly refetchOn: ReadonlyArray<Stream.Stream<unknown>>
  /** Forced (but deduped) refetch period in milliseconds. */
  readonly refetchInterval: number | undefined
  /** Whether a new observer on an existing stale entry refetches. */
  readonly refetchOnMount: boolean
}

/** A query atom: its value is the fetch `Result`; writing `A` seeds a `Success`. */
export interface QueryAtom<A, E> extends Atom.Writable<Result.Result<A, E | Atom.ScopeError>, A> {
  readonly [TypeId]: QueryInfo
}

/** One registry entry per built query node in a store. */
export interface QueryEntry {
  readonly id: string
  readonly key: string
  readonly tuple: ReadonlyArray<unknown>
  readonly atom: QueryAtom<unknown, unknown>
  /** Time (ms) of the last successful fetch or write; `undefined` when never fetched. */
  updatedAt: number | undefined
  /** Number of active `observe` calls. */
  observers: number
  /** @internal */ live: boolean
  /** @internal stops the trigger fiber */ stop: (() => void) | undefined
}

// One Map per store: a keepAlive atom is built once per store and never recomputed; its finalizer runs on
// store disposal and stops every trigger fiber still running there.
const registryAtom = Atom.keepAlive(
  Atom.make((get): Map<string, QueryEntry> => {
    const registry = new Map<string, QueryEntry>()
    get.addFinalizer(() => { for (const e of registry.values()) { e.stop?.(); e.stop = undefined } })
    return registry
  }),
)
let definitions = 0

/**
 * The query registry of `store`: entry id (definition + canonical key) -> entry, filled on read and cleared when the node is removed.
 *
 * @param store - The atom store.
 * @returns The live registry (read-only view).
 */
export const entries = (store: AtomStore): ReadonlyMap<string, QueryEntry> => store.get(registryAtom)

/** Options for {@link make}. */
export interface QueryOptions<Args, A, E, R> {
  /** Maps arguments to a JSON-serializable key tuple. */
  readonly key: (args: Args) => ReadonlyArray<unknown>
  /** The fetch (an Effect, or a Stream for a live query); its requirements resolve from the store's scope. */
  readonly fetch: (args: Args) => Effect.Effect<A, E, R> | Stream.Stream<A, E, R>
  /** How long a value stays fresh. Defaults to 0. */
  readonly staleTime?: Duration.DurationInput
  /** Idle time before an unobserved node is removed (in-flight fetch interrupted). `Infinity` keeps it. Defaults to 5 minutes. */
  readonly gcTime?: Duration.DurationInput
  /** Re-runs typed Effect failures; defects and interruption are never retried. A Stream retries per its own pipeline. */
  readonly retry?: Schedule.Schedule<unknown, NoInfer<E>>
  /** Pluggable stale-gated refetch triggers (focus, reconnect, ...); the core has no DOM sources. */
  readonly refetchOn?: ReadonlyArray<Stream.Stream<unknown>>
  /** Refetch period, regardless of staleness; skipped while a fetch or retry runs. */
  readonly refetchInterval?: Duration.DurationInput
  /** Refetch a stale entry when a new observer arrives. Defaults to true. */
  readonly refetchOnMount?: boolean
}

/**
 * Defines a query: a family `(args) => QueryAtom` keyed by the canonical form of `key(args)`.
 *
 * @param options - Key, fetch and cache policy.
 * @returns The family; two equal keys return the same atom.
 * @throws InvalidQueryKey when `key(args)` is not serializable.
 *
 * @example
 * ```ts
 * const todo = Query.make({
 *   key: (id: string) => ['todo', id],
 *   fetch: (id) => Effect.flatMap(TodoApi, (api) => api.get(id)),
 *   staleTime: '30 seconds',
 * })
 * ```
 */
export const make = <Args, A, E = never, R = never>(options: QueryOptions<Args, A, E, R>): ((args: Args) => QueryAtom<A, E>) => {
  const millis = (d: Duration.DurationInput | undefined, fallback: number) => (d === undefined ? fallback : Duration.toMillis(d))
  const staleTime = millis(options.staleTime, 0)
  const gcTime = millis(options.gcTime, 5 * 60_000)
  const refetchInterval = options.refetchInterval === undefined ? undefined : Duration.toMillis(options.refetchInterval)
  const definition = ++definitions
  let pending: { args: Args; tuple: ReadonlyArray<unknown> } | undefined
  const build = (key: string): QueryAtom<A, E> => {
    const { args, tuple } = pending!
    const id = `${definition}:${key}`
    let self: QueryAtom<A, E>
    const base = Atom.make((get) => {
      const registry = get(registryAtom)
      let entry = registry.get(id)
      if (!entry) {
        entry = { id, key, tuple, atom: self as QueryAtom<unknown, unknown>, updatedAt: undefined, observers: 0, live: true, stop: undefined }
        registry.set(id, entry)
      }
      const e = entry
      e.live = true
      // a rebuild runs this finalizer then re-reads synchronously; only a removal leaves the entry dead
      get.addFinalizer(() => {
        e.live = false
        queueMicrotask(() => { if (!e.live && registry.get(id) === e) registry.delete(id) })
      })
      const fetch = options.fetch(args)
      const touch = () => Effect.sync(() => { e.updatedAt = Date.now() })
      // the Stream branch is typed as an Effect atom: Atom.make dispatches on the runtime value, not the overload
      if (!Effect.isEffect(fetch)) return Stream.tap(fetch, touch) as unknown as Effect.Effect<A, E, R>
      return (options.retry ? Effect.retry(fetch, options.retry) : fetch).pipe(Effect.tap(touch))
    })
    const writable = Atom.writable(base.read, (ctx, value: A) => {
      ctx.setSelf(Result.success(value))
      const entry = ctx.get(registryAtom).get(id)
      if (entry) entry.updatedAt = Date.now()
    })
    const policy = Number.isFinite(gcTime) ? Atom.setIdleTTL(writable, gcTime) : Atom.keepAlive(writable)
    self = Object.assign(policy, {
      [TypeId]: { key, id, tuple, staleTime, refetchOn: options.refetchOn ?? [], refetchInterval, refetchOnMount: options.refetchOnMount ?? true },
    }) as QueryAtom<A, E>
    return self
  }
  const family = Atom.family(build)
  return (args) => {
    const tuple = options.key(args)
    const key = canonicalKey(tuple)
    pending = { args, tuple }
    try { return family(key) } finally { pending = undefined }
  }
}

/**
 * Refetches `atom` unless a fetch (or retry) is already running, or, when not `force`d, the value is still fresh.
 *
 * @param store - The store holding the query.
 * @param atom - The query atom.
 * @param force - Ignore `staleTime`.
 */
export const trigger = (store: AtomStore, atom: QueryAtom<any, any>, force = false): void => {
  const info = atom[TypeId]
  const entry = entries(store).get(info.id)
  if (!entry || store.get(atom).waiting) return
  if (!force && entry.updatedAt !== undefined && Date.now() - entry.updatedAt < info.staleTime) return
  store.refresh(atom)
}

/**
 * Observes a query: subscribes, refetches a stale existing entry on mount, and runs its refetch triggers
 * while at least one observer remains.
 *
 * @param store - The store holding the query.
 * @param atom - The query atom.
 * @param listener - Called when the result changes.
 * @returns The release function (idempotent).
 */
export const observe = <A, E>(store: AtomStore, atom: QueryAtom<A, E>, listener: () => void = () => {}): (() => void) => {
  const info = atom[TypeId]
  const existed = entries(store).has(info.id)
  const unsubscribe = store.subscribe(atom, listener)
  const entry = entries(store).get(info.id)!
  if (existed && info.refetchOnMount) trigger(store, atom)
  if (++entry.observers === 1) {
    const sources: Array<Stream.Stream<boolean>> = info.refetchOn.map((s) => Stream.as(s, false))
    if (info.refetchInterval !== undefined) sources.push(Stream.tick(Duration.millis(info.refetchInterval)).pipe(Stream.drop(1), Stream.as(true)))
    if (sources.length > 0) {
      const fiber = Effect.runFork(
        Stream.runForEach(Stream.mergeAll(sources, { concurrency: 'unbounded' }), (force) => Effect.sync(() => trigger(store, atom, force))),
      )
      entry.stop = () => { Effect.runFork(Fiber.interrupt(fiber)) }
    }
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--entry.observers === 0) { entry.stop?.(); entry.stop = undefined }
    unsubscribe()
  }
}
