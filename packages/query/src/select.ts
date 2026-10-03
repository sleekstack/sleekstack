/**
 * packages/query/src/select.ts
 *
 * `select`: an Effect-valued projection of a query (a DTO -> Model step such as `Model.fromDto`). It runs
 * in the reading store, so its requirements resolve from that scope, and re-runs only when the data
 * reference changes: an intermediate atom reuses its projection object while the reference (compared with
 * `Object.is`) is unchanged, so a revalidation does not re-select. A failed refetch with cached data
 * surfaces as a `Failure` keeping the previous selected value.
 */

import { Atom, Result } from '@sleekstack/core'
import { Effect, Option, type Cause } from 'effect'
import type { QueryAtom } from './query'

/**
 * Builds a selector over query atoms.
 *
 * @param f - Maps the data to the selected value; its requirements resolve from the reading store's scope.
 * @returns `(query) => atom` (one atom per query). The atom is `Initial`/`Failure` while the query has no data, `Failure` (previous value kept) after a failed refetch,
 * keeps the previous selected value with `waiting` while a re-select runs, and fails with the scope error
 * when `f` needs an unprovided service.
 *
 * @example
 * ```ts
 * const taskModel = Query.select(TaskModel.fromDto)
 * store.get(taskModel(task('t1')))
 * ```
 */
export const select = <A, B, R>(f: (a: A) => Effect.Effect<B, never, R>) => {
  const memo = new WeakMap<object, Atom.Atom<unknown>>()
  return <E>(query: QueryAtom<A, E>): Atom.Atom<Result.Result<B, E | Atom.ScopeError>> => {
    let selected = memo.get(query)
    if (!selected) {
      // the projection object is reused while the data reference and the failure are unchanged
      type Projection = { readonly data: A; readonly cause: Cause.Cause<E | Atom.ScopeError> | undefined }
      const data = Atom.make((get) => {
        const r = get(query)
        const value = Result.value(r)
        if (Option.isNone(value)) return r
        const cause = Result.isFailure(r) ? r.cause : undefined
        const prev = get.self<Projection | typeof r>()
        return prev && 'data' in prev && Object.is(prev.data, value.value) && prev.cause === cause ? prev : { data: value.value, cause }
      })
      selected = Atom.make((get) => {
        const d = get(data)
        if ('_tag' in d) return Result.isFailure(d) ? Result.failure(d.cause) : Result.initial(d.waiting)
        if (d.cause) {
          const prev = get.self<Result.Result<B, unknown>>()
          return Result.failure(d.cause, { previousValue: prev ? Result.value(prev) : Option.none() })
        }
        return Atom.make(f(d.data)).read(get)
      })
      memo.set(query, selected)
    }
    return selected as Atom.Atom<Result.Result<B, E | Atom.ScopeError>>
  }
}
