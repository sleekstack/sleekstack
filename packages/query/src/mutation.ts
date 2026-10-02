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
const clientFor = (store: AtomStore) => {
  let c = clients.get(store)
  if (!c) clients.set(store, (c = Queries.make(store)))
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
        Effect.onExit((exit) => (Exit.isSuccess(exit) || !rollback ? Effect.void : rollback)),
        Effect.tap((a) => o.onSuccess?.(a, input) ?? Effect.void),
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

// Per-client, per-query stack of pending optimistic writes; each layer remembers the value beneath it.
const stacks = new WeakMap<Queries.QueriesApi, Map<string, Array<{ previous: Option.Option<unknown> }>>>()

/**
 * Writes `f(previous)` into `atom` for the duration of the call and returns its rollback. Rolling back the
 * top write restores the value beneath it; rolling back a lower one keeps the later write (the layer above
 * now restores past both). A settled-successful write leaves the stack when the call's scope closes.
 */
export const optimistic = <A>(
  atom: QueryAtom<A, any>,
  f: (previous: Option.Option<A>) => A,
): Effect.Effect<Effect.Effect<void>, never, Queries.Queries | Scope.Scope> =>
  Effect.gen(function* () {
    const client = yield* Queries.Queries
    let byKey = stacks.get(client)
    if (!byKey) stacks.set(client, (byKey = new Map()))
    const id = atom[TypeId].id
    const stack = byKey.get(id) ?? []
    byKey.set(id, stack)
    const layer = { previous: client.getData(atom) as Option.Option<unknown> }
    client.setData(atom, f(layer.previous as Option.Option<A>))
    stack.push(layer)
    const remove = (restore: boolean) => {
      const i = stack.indexOf(layer)
      if (i < 0) return
      stack.splice(i, 1)
      // a committed lower write stays beneath the layer above, which already restores to it
      if (restore && i < stack.length) stack[i]!.previous = layer.previous
      else if (restore) Option.match(layer.previous as Option.Option<A>, { onNone: () => client.reset(atom), onSome: (v) => client.setData(atom, v) })
      if (stack.length === 0) byKey.delete(id)
    }
    yield* Effect.addFinalizer(() => Effect.sync(() => remove(false)))
    return Effect.sync(() => remove(true))
  })
