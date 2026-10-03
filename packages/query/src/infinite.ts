/**
 * packages/query/src/infinite.ts
 *
 * `Query.infinite`: a paginated query on `Query.make`. Its value is one `{ pages, pageParams }`. A plain
 * (re)fetch re-runs the loaded pages sequentially from the first; `fetchNext` / `fetchPrevious` rebuild
 * the node with a one-page fetch appended or prepended. Either fetch fails as a whole, so the node's
 * `Failure` keeps the previous pages as its `previousValue`.
 */

import { Result, type AtomStore } from '@sleekstack/core'
import { Effect } from 'effect'
import { entries, make, TypeId, type QueryAtom, type QueryOptions } from './query'

/** The value of an infinite query. */
export interface InfiniteData<A, P> {
  readonly pages: ReadonlyArray<A>
  readonly pageParams: ReadonlyArray<P>
}

/** An infinite query atom. */
export type InfiniteQueryAtom<A, P, E> = QueryAtom<InfiniteData<A, P>, E>

/** Options for {@link infinite}. */
export interface InfiniteOptions<Args, A, P, E, R> extends Omit<QueryOptions<Args, InfiniteData<A, P>, E, R>, 'fetch'> {
  /** Fetches one page. */
  readonly fetchPage: (args: Args, param: P) => Effect.Effect<A, E, R>
  /** The first page's param. */
  readonly initialParam: P
  /** The param after `last`; `undefined` when there is no next page. */
  readonly getNextParam: (last: A, data: InfiniteData<A, P>) => P | undefined
  /** The param before `first`; `undefined` (or omitted) when there is no previous page. */
  readonly getPreviousParam?: (first: A, data: InfiniteData<A, P>) => P | undefined
  /** Pages kept; fetching past it drops pages from the opposite end. */
  readonly maxPages?: number
}

// The waiting Result a page fetch produced -> its direction; a later refetch yields a new Result object.
const directions = new WeakMap<object, 'next' | 'previous'>()
const brand = Symbol('@sleekstack/query/infinite')
// Set synchronously around the rebuild `fetchNext`/`fetchPrevious` trigger.
let request: { readonly atom: object; readonly direction: 'next' | 'previous' } | undefined

/**
 * Defines an infinite (paginated) query.
 *
 * @param options - Key, page fetch, param functions, `maxPages` and the `Query.make` cache policy.
 * @returns The family `(args) => InfiniteQueryAtom`.
 * @throws InvalidQueryKey when `key(args)` is not serializable.
 */
export const infinite = <Args, A, P, E = never, R = never>(
  options: InfiniteOptions<Args, A, P, E, R>,
): ((args: Args) => InfiniteQueryAtom<A, P, E>) => {
  const max = options.maxPages ?? Infinity
  // `fetch` is called synchronously inside the node's read; the wrapped read hands it the previous data.
  let previous: InfiniteData<A, P> | undefined
  let direction: 'next' | 'previous' | undefined
  const fetch = (args: Args): Effect.Effect<InfiniteData<A, P>, E, R> => {
    const prev = previous
    const dir = direction
    if (prev && dir === 'next') {
      const param = options.getNextParam(prev.pages[prev.pages.length - 1]!, prev)
      if (param === undefined) return Effect.succeed(prev)
      return Effect.map(options.fetchPage(args, param), (page) => ({
        pages: [...prev.pages, page].slice(-max),
        pageParams: [...prev.pageParams, param].slice(-max),
      }))
    }
    if (prev && dir === 'previous') {
      const param = options.getPreviousParam?.(prev.pages[0]!, prev)
      if (param === undefined) return Effect.succeed(prev)
      return Effect.map(options.fetchPage(args, param), (page) => ({
        pages: [page, ...prev.pages].slice(0, max),
        pageParams: [param, ...prev.pageParams].slice(0, max),
      }))
    }
    // sequential refetch: as many pages as were loaded, params recomputed from the fresh pages
    const count = Math.max(prev?.pages.length ?? 1, 1)
    return Effect.gen(function* () {
      const data: { pages: A[]; pageParams: P[] } = { pages: [], pageParams: [] }
      let param: P | undefined = prev?.pageParams[0] ?? options.initialParam
      while (param !== undefined && data.pages.length < count) {
        data.pages.push(yield* options.fetchPage(args, param))
        data.pageParams.push(param)
        param = options.getNextParam(data.pages[data.pages.length - 1]!, data)
      }
      return data
    })
  }
  const family = make<Args, InfiniteData<A, P>, E, R>({ ...options, fetch })
  return (args) => {
    const atom = family(args) as InfiniteQueryAtom<A, P, E> & { [brand]?: true; read: InfiniteQueryAtom<A, P, E>['read'] }
    if (!atom[brand]) {
      // ponytail: wraps the family atom's read in place (query.ts gives fetch no access to the node); a
      // `fetch(args, previous)` hook in Query.make is the upgrade if a second caller needs it.
      const read = atom.read
      atom.read = (get) => {
        const self = get.self<Result.Result<InfiniteData<A, P>, unknown>>()
        const value = self ? Result.value(self) : undefined
        previous = value?._tag === 'Some' ? value.value : undefined
        direction = request?.atom === atom ? request.direction : undefined
        try {
          const result = read(get)
          // recorded before the store notifies subscribers, so a listener sees the direction
          if (direction && result.waiting) directions.set(result, direction)
          return result
        } finally { previous = undefined; direction = undefined }
      }
      atom[brand] = true
    }
    return atom
  }
}

const page = (direction: 'next' | 'previous') => (store: AtomStore, atom: InfiniteQueryAtom<any, any, any>): void => {
  if (!entries(store).has(atom[TypeId].id)) return
  const current = store.get(atom)
  if (current.waiting || Result.isInitial(current)) return
  const prior = request
  request = { atom, direction }
  try { store.refresh(atom); store.get(atom) } finally { request = prior }
}

/** Fetches the page after the last one (no-op while a fetch runs or before the first page). */
export const fetchNext = page('next')
/** Fetches the page before the first one (no-op while a fetch runs or before the first page). */
export const fetchPrevious = page('previous')
/** True while a `fetchNext` runs (a plain refetch is only `waiting`). */
export const isFetchingNext = (store: AtomStore, atom: InfiniteQueryAtom<any, any, any>): boolean => directions.get(store.get(atom)) === 'next'
/** True while a `fetchPrevious` runs. */
export const isFetchingPrevious = (store: AtomStore, atom: InfiniteQueryAtom<any, any, any>): boolean => directions.get(store.get(atom)) === 'previous'

// The `Query` namespace is query.ts plus these and `select` (index.ts re-exports this module as `Query`).
export * from './query'
export { select } from './select'
