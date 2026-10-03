/**
 * packages/query/src/mutation.ts
 *
 * `Mutation.make`: a definition run by a per-caller {@link runner} whose state is an atom
 * (`idle | pending | success | failure`). Per call: `Queries.cancel(target)` -> `onMutate` (returns a
 * rollback) -> `run` -> `onSuccess`/`onError` -> `onSettled`. Failure or interruption of `run` runs
 * the rollback; {@link optimistic} writes stack per key so overlapping rollbacks never wipe a later write.
 */

import { Atom, Result, type AtomStore } from '@sleekstack/core'
import { Cause, Effect, Exit, Fiber, Option, Scope } from 'effect'
import * as Queries from './queries'
import { TypeId, type QueryAtom } from './query'

/** A runner's state: the latest call's progress. */
export type MutationState<A, E> =
  | { readonly _tag: 'idle' }
  | { readonly _tag: 'pending' }
  | { readonly _tag: 'success'; readonly value: A }
  | { readonly _tag: 'failure'; readonly cause: Cause.Cause<E> }

/** How a runner handles a call while an earlier one is in flight. */
export type Concurrency = 'switch' | 'queue' | 'parallel'

/** Options for {@link make}. Hook requirements may include `Queries` (provided by the runner) and `Scope` (the call's). */
export interface MutationOptions<I, A, E, R> {
  /** The mutation; a Draft's `toDto` Effect piped into the API call is a valid body. */
  readonly run: (input: I) => Effect.Effect<A, E, R>
  /** Query target cancelled before `onMutate`, so an in-flight fetch never overwrites the optimistic write. */
  readonly cancel?: (input: I) => Queries.QueryTarget
  /** Runs before `run`; its failure aborts the call. Returns the rollback run on `run`'s failure or interruption. */
  readonly onMutate?: (input: I) => Effect.Effect<Effect.Effect<void, never, R> | void, E, R | Queries.Queries | Scope.Scope>
  readonly onSuccess?: (value: A, input: I) => Effect.Effect<void, never, R | Queries.Queries>
  readonly onError?: (cause: Cause.Cause<E>, input: I) => Effect.Effect<void, never, R | Queries.Queries>
  /** Runs after every call, including an aborted `onMutate`. */
  readonly onSettled?: (input: I) => Effect.Effect<void, never, R | Queries.Queries>
  /** Defaults to `parallel`. */
  readonly concurrency?: Concurrency
  /** Interrupt in-flight calls when the runner is released (unmount). Defaults to false. */
  readonly interruptOnUnmount?: boolean
}

/** A mutation definition. */
export interface Mutation<I, A, E, R> {
  readonly options: MutationOptions<I, A, E, R>
  /** Set by {@link shared}: every runner on a store shares one state and concurrency. */
  readonly shared: boolean
}

/** A caller's handle on a mutation. */
export interface Runner<I, A, E> {
  /** The state atom (read it from the store the runner was made on). */
  readonly state: Atom.Atom<MutationState<A, E>>
  /** Starts a call; resolves with its Exit (interrupted under `switch` when superseded). */
  readonly mutate: (input: I) => Promise<Exit.Exit<A, E>>
  /** Returns the state to `idle` (in-flight calls keep running). */
  readonly reset: () => void
  /** Unmount: drops the state; interrupts in-flight calls only with `interruptOnUnmount`. */
  readonly release: () => void
}

/**
 * Defines a mutation.
 *
 * @example
 * ```ts
 * const rename = Mutation.make({
 *   run: (input: RenameInput) => Effect.flatMap(TodoApi, (api) => api.rename(input)),
 *   cancel: (input) => todo(input.id),
 *   onMutate: (input) => Mutation.optimistic(todo(input.id), (t) => ({ ...Option.getOrThrow(t), title: input.title })),
 * })
 * ```
 */
export const make = <I, A, E = never, R = never>(options: MutationOptions<I, A, E, R>): Mutation<I, A, E, R> => ({ options, shared: false })

/** Opts a definition into one shared state per store. */
export const shared = <I, A, E, R>(self: Mutation<I, A, E, R>): Mutation<I, A, E, R> => ({ ...self, shared: true })

// Resolved once per store, synchronously: the store's context, and the in-flight fibers its disposal interrupts.
const contextAtom = Atom.keepAlive(Atom.make(Effect.context<never>()))
const fibersAtom = Atom.keepAlive(
  Atom.make((get): Set<Fiber.RuntimeFiber<any, any>> => {
    const fibers = new Set<Fiber.RuntimeFiber<any, any>>()
    get.addFinalizer(() => { for (const f of fibers) Effect.runFork(Fiber.interrupt(f)) })
    return fibers
  }),
)
const clients = new WeakMap<AtomStore, Queries.QueriesApi>()
const storeOf = new WeakMap<Queries.QueriesApi, AtomStore>()
const clientFor = (store: AtomStore) => {
  let c = clients.get(store)
  if (!c) { clients.set(store, (c = Queries.make(store))); storeOf.set(c, store) }
  return c
}
const sharedRunners = new WeakMap<AtomStore, Map<Mutation<any, any, any, any>, Runner<any, any, any>>>()

/**
 * A runner for `mutation` on `store` (per caller, or the store's shared one for a {@link shared} definition).
 * Store disposal interrupts its in-flight calls (rollbacks run).
 */
export const runner = <I, A, E, R>(store: AtomStore, mutation: Mutation<I, A, E, R>): Runner<I, A, E> => {
  if (mutation.shared) {
    let map = sharedRunners.get(store)
    if (!map) sharedRunners.set(store, (map = new Map()))
    let r = map.get(mutation)
    if (!r) map.set(mutation, (r = { ...build(store, mutation), release: () => {} }))
    return r
  }
  return build(store, mutation)
}

const build = <I, A, E, R>(store: AtomStore, { options: o }: Mutation<I, A, E, R>): Runner<I, A, E> => {
  const state = Atom.make<MutationState<A, E>>({ _tag: 'idle' })
  const unmount = store.mount(state)
  const queries = clientFor(store)
  const mode = o.concurrency ?? 'parallel'
  const lock = Effect.unsafeMakeSemaphore(1)
  const inflight = new Set<Fiber.RuntimeFiber<A, E>>()
  let latest = 0

  const call = (input: I): Effect.Effect<A, E, R | Queries.Queries | Scope.Scope> =>
    Effect.suspend(() => {
      if (o.cancel) queries.cancel(o.cancel(input))
      return o.onMutate ? o.onMutate(input) : Effect.void
    }).pipe(
      Effect.flatMap((rollback) => o.run(input).pipe(
        Effect.tap((a) => o.onSuccess?.(a, input) ?? Effect.void),
        Effect.onExit((exit) => (Exit.isSuccess(exit) || !rollback ? Effect.void : rollback)),
      )),
      Effect.tapErrorCause((cause) => o.onError?.(cause, input) ?? Effect.void),
      Effect.ensuring(Effect.suspend(() => o.onSettled?.(input) ?? Effect.void)),
    )

  const mutate = (input: I) => {
    const ctx = Result.value(store.get(contextAtom)).pipe(Option.getOrThrow)
    const id = ++latest
    const set = (s: MutationState<A, E>) => { if (id === latest) store.set(state, s) }
    let effect = Effect.scoped(call(input))
    if (mode === 'queue') effect = lock.withPermits(1)(effect)
    // the previous call is fully interrupted (rollback included) before this one starts
    if (mode === 'switch') effect = Effect.zipRight(Fiber.interruptAll([...inflight]), effect)
    const fiber = Effect.runFork(effect.pipe(
      Effect.provideService(Queries.Queries, queries),
      Effect.provide(ctx),
    ) as Effect.Effect<A, E>)
    const fibers = store.get(fibersAtom)
    inflight.add(fiber)
    fibers.add(fiber)
    set({ _tag: 'pending' })
    fiber.addObserver((exit) => {
      inflight.delete(fiber)
      fibers.delete(fiber)
      if (Exit.isSuccess(exit)) set({ _tag: 'success', value: exit.value })
      else if (!Cause.isInterruptedOnly(exit.cause)) set({ _tag: 'failure', cause: exit.cause })
    })
    return Effect.runPromise(Fiber.await(fiber))
  }

  return {
    state,
    mutate,
    reset: () => { latest++; store.set(state, { _tag: 'idle' }) },
    release: () => {
      unmount()
      if (o.interruptOnUnmount) for (const f of inflight) Effect.runFork(Fiber.interrupt(f))
    },
  }
}

// Per-client, per-query log of optimistic writes over the value beneath the oldest one. The cached
// value is the log folded over that base; a write leaves the log on rollback, and folds into the base
// once it and every older write have committed. While the log lives, a settled cache result the log did
// not write (a refetch or an outside write) becomes the new base and the layers are re-applied over it.
interface Layer { readonly f: (previous: Option.Option<any>) => any; committed: boolean }
interface Log { base: Option.Option<unknown>; layers: Array<Layer>; render: () => void; stop: () => void }
const logs = new WeakMap<Queries.QueriesApi, Map<string, Log>>()

/**
 * Writes `f(previous)` into `atom` for the duration of the call and returns its rollback (also run when the
 * call's scope closes on failure or interruption). Rolling one write back recomputes the value from the
 * remaining writes, so overlapping rollbacks run in reverse order and never wipe a later write, committed or not.
 */
export const optimistic = <A>(
  atom: QueryAtom<A, any>,
  f: (previous: Option.Option<A>) => A,
): Effect.Effect<Effect.Effect<void>, never, Queries.Queries | Scope.Scope> =>
  Effect.gen(function* () {
    const client = yield* Queries.Queries
    let byKey = logs.get(client)
    if (!byKey) logs.set(client, (byKey = new Map()))
    const id = atom[TypeId].id
    let found = byKey.get(id)
    if (!found) {
      const store = storeOf.get(client)
      let shown: unknown
      const l: Log = {
        base: client.getData(atom),
        layers: [],
        render: () => {
          const value = l.layers.reduce((acc, x) => Option.some(x.f(acc)), l.base as Option.Option<A>)
          shown = undefined // our own write: never read back as a new base
          Option.match(value, { onNone: () => client.reset(atom), onSome: (v) => client.setData(atom, v) })
          if (store) shown = store.get(atom)
        },
        // without the runner's store (a hand-provided Queries) there is nothing to observe
        stop: store
          ? store.subscribe(atom, () => {
              const r = store.get(atom)
              if (shown === undefined || r === shown || r.waiting) return
              l.base = client.getData(atom)
              l.render()
            })
          : () => {},
      }
      byKey.set(id, (found = l))
    }
    const log = found
    const layer: Layer = { f, committed: false }
    log.layers.push(layer)
    log.render()
    const settle = (commit: boolean) => {
      const i = log.layers.indexOf(layer)
      if (i < 0 || layer.committed) return
      if (commit) layer.committed = true
      else { log.layers.splice(i, 1); log.render() }
      while (log.layers[0]?.committed) log.base = Option.some(log.layers.shift()!.f(log.base))
      if (log.layers.length === 0) { log.stop(); byKey.delete(id) }
    }
    yield* Effect.addFinalizer((exit) => Effect.sync(() => settle(Exit.isSuccess(exit))))
    return Effect.sync(() => settle(false))
  })
