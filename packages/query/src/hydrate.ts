/**
 * packages/query/src/hydrate.ts
 *
 * SSR for query atoms: `prefetch` runs queries in a throwaway store built from the running Effect's
 * context and returns a serializable `Dehydrated`; `hydrate` stages it on a client store, and `apply`
 * seeds one query from it when a hook first reads that query (the staged entries carry keys, not atoms).
 */

import { makeAtomStore, Result, type AtomStore } from '@sleekstack/core'
import { Cause, Effect, Either, Option, Schema } from 'effect'
import { make as makeQueries } from './queries'
import { entries, TypeId, type QueryAtom } from './query'

/** One dehydrated query: canonical key, encoded value (or opted-in encoded error) and fetch time. */
export type DehydratedEntry =
  | { readonly key: string; readonly result: 'success'; readonly value: unknown; readonly updatedAt: number }
  | { readonly key: string; readonly result: 'failure'; readonly error: unknown; readonly updatedAt: number }

/** Serializable query state handed from the server to `<HydrateQueries state>`. */
export type Dehydrated = ReadonlyArray<DehydratedEntry>

/** Schemas a query's value (and optionally its typed error) is encoded with across the wire. */
export interface Codec<A, E> {
  readonly value: Schema.Schema<A, any, never>
  readonly error?: Schema.Schema<E, any, never>
}

const codecs = new WeakMap<object, Codec<any, any>>()

/**
 * Makes a query family dehydratable: every atom it returns carries `codec` (required by `prefetch`/`apply`).
 *
 * @param family - A `Query.make` family.
 * @param codec - The value Schema (DTO-only plain JSON), and optionally the error Schema.
 * @returns The same family, registering the codec on each atom.
 *
 * @example
 * ```ts
 * const todo = Hydrate.hydratable(Query.make({ key: (id: string) => ['todo', id], fetch }), { value: TodoDto })
 * ```
 */
export const hydratable = <Args, A, E>(family: (args: Args) => QueryAtom<A, E>, codec: Codec<A, E>) =>
  (args: Args): QueryAtom<A, E> => {
    const atom = family(args)
    codecs.set(atom, codec)
    return atom
  }

const codecOf = (atom: QueryAtom<any, any>): Codec<any, any> => {
  const c = codecs.get(atom)
  if (!c) throw new Error(`Query ${atom[TypeId].key} has no Schema: wrap its family with Hydrate.hydratable to dehydrate it.`)
  return c
}

/** Options for {@link prefetch} / {@link dehydrate}. */
export interface DehydrateOptions {
  /** Also dehydrate typed failures (encoded with the codec's `error` Schema). Defaults to false. */
  readonly failures?: boolean
}

/**
 * Encodes the settled queries of `store`; unfetched, failed (unless opted in) or unencodable entries are left out.
 *
 * @param store - The store holding the queries.
 * @param atoms - The queries to dehydrate.
 * @param options - `failures` opt-in.
 */
export const dehydrate = (store: AtomStore, atoms: ReadonlyArray<QueryAtom<any, any>>, options: DehydrateOptions = {}): Dehydrated => {
  const out: Array<DehydratedEntry> = []
  for (const atom of atoms) {
    const codec = codecOf(atom)
    const updatedAt = entries(store).get(atom[TypeId].id)?.updatedAt ?? Date.now()
    const result = store.get(atom)
    const key = atom[TypeId].key
    if (result._tag === 'Success') {
      const value = Schema.encodeEither(codec.value)(result.value)
      if (Either.isRight(value)) out.push({ key, result: 'success', value: value.right, updatedAt })
    } else if (result._tag === 'Failure' && options.failures && codec.error) {
      const typed = Cause.failureOption(result.cause)
      const error = Option.isSome(typed) ? Schema.encodeEither(codec.error)(typed.value) : undefined
      if (error && Either.isRight(error)) out.push({ key, result: 'failure', error: error.right, updatedAt })
    }
  }
  return out
}

const settled = (store: AtomStore, atom: QueryAtom<any, any>): Promise<void> =>
  new Promise((resolve) => {
    const done = () => { const r = store.get(atom); return r._tag !== 'Initial' && !r.waiting }
    if (done()) return resolve()
    const unsubscribe = store.subscribe(atom, () => { if (done()) { unsubscribe(); resolve() } })
  })

/**
 * Runs `atoms`' fetches with the current Effect's services (run it in the request scope, e.g. via
 * `@sleekstack/next`'s `prefetch`) and dehydrates the results.
 *
 * @param atoms - Hydratable query atoms.
 * @param options - `failures` opt-in.
 * @returns An Effect of the `Dehydrated` state; requirements are the queries'.
 */
export const prefetch = (atoms: ReadonlyArray<QueryAtom<any, any>>, options: DehydrateOptions = {}): Effect.Effect<Dehydrated, never, any> =>
  Effect.flatMap(Effect.context<any>(), (context) => {
    for (const atom of atoms) codecOf(atom)
    const store = makeAtomStore({ context })
    return Effect.acquireUseRelease(
      Effect.sync(() => atoms.map((a) => store.mount(a))),
      () => Effect.promise(() => Promise.all(atoms.map((a) => settled(store, a)))).pipe(Effect.map(() => dehydrate(store, atoms, options))),
      () => Effect.promise(() => store.dispose()),
    )
  })

/** Decodes a dehydrated entry for `atom`: its `Result`, or `undefined` when it fails its Schema (dropped). */
export const decode = <A, E>(atom: QueryAtom<A, E>, entry: DehydratedEntry): Result.Result<A, E> | undefined => {
  const codec = codecOf(atom) as Codec<A, E>
  if (entry.result === 'success') {
    const v = Schema.decodeUnknownEither(codec.value)(entry.value)
    return Either.isRight(v) ? Result.success(v.right) : undefined
  }
  if (!codec.error) return undefined
  const e = Schema.decodeUnknownEither(codec.error)(entry.error)
  return Either.isRight(e) ? Result.failure(Cause.fail(e.right)) : undefined
}

const staged = new WeakMap<AtomStore, Map<string, DehydratedEntry>>()

/**
 * Stages `state` on `store`; each entry seeds its query on the first {@link apply} for that key.
 *
 * @param store - The client query store.
 * @param state - The server's `Dehydrated` state.
 */
export const hydrate = (store: AtomStore, state: Dehydrated): void => {
  let m = staged.get(store)
  if (!m) staged.set(store, (m = new Map()))
  for (const entry of state) {
    const prior = m.get(entry.key)
    if (!prior || prior.updatedAt < entry.updatedAt) m.set(entry.key, entry)
  }
}

/**
 * Seeds `atom` from its staged entry (once): a value that fails its Schema is dropped (the query then
 * fetches), an entry older than the mounted one is ignored, and the seeded entry is fresh until `staleTime`
 * counted from the server's `updatedAt`.
 * A failure entry (opted in at `prefetch`) is shown by {@link hydratedFailure} until the query's own
 * fetch settles: atoms only accept values, and the client refetches a failure.
 *
 * @param store - The client query store.
 * @param atom - The query being read.
 */
export const apply = (store: AtomStore, atom: QueryAtom<any, any>): void => {
  const m = staged.get(store)
  const entry = m?.get(atom[TypeId].key)
  if (!entry) return
  m!.delete(atom[TypeId].key)
  if (!codecs.has(atom)) return
  const decoded = decode(atom, entry)
  if (!decoded) return
  const current = entries(store).get(atom[TypeId].id)
  if (current?.updatedAt !== undefined && current.updatedAt >= entry.updatedAt) return
  if (decoded._tag === 'Failure') {
    let f = failures.get(store)
    if (!f) failures.set(store, (f = new Map()))
    f.set(atom[TypeId].id, decoded)
    return
  }
  makeQueries(store).setData(atom, (decoded as Result.Success<unknown>).value)
  entries(store).get(atom[TypeId].id)!.updatedAt = entry.updatedAt
}

const failures = new WeakMap<AtomStore, Map<string, Result.Result<any, any>>>()

/**
 * The hydrated failure of `atom` while its own `current` result is still `Initial`; dropped once it settles.
 *
 * @param store - The client query store.
 * @param atom - The query.
 * @param current - The query's current result in `store`.
 * @returns The hydrated `Failure`, or `undefined`.
 */
export const hydratedFailure = <A, E>(store: AtomStore, atom: QueryAtom<A, E>, current: Result.Result<A, any>): Result.Result<A, E> | undefined => {
  const f = failures.get(store)
  const failure = f?.get(atom[TypeId].id)
  if (!failure) return undefined
  if (current._tag !== 'Initial') { f!.delete(atom[TypeId].id); return undefined }
  return failure
}

let serverRunner: ((atoms: ReadonlyArray<QueryAtom<any, any>>) => Promise<Dehydrated>) | undefined

/**
 * Registers how a server render fetches a query nobody prefetched (`@sleekstack/next` registers `prefetch`).
 *
 * @param run - Runs and dehydrates the given queries in a request scope.
 */
export const setServerRunner = (run: typeof serverRunner): void => { serverRunner = run }

/** @internal The registered server runner. */
export const serverRun = (atoms: ReadonlyArray<QueryAtom<any, any>>): Promise<Dehydrated> => {
  if (!serverRunner) return Promise.reject(new Error('No server query runner: import @sleekstack/next (or call Hydrate.setServerRunner) on the server.'))
  return serverRunner(atoms)
}
