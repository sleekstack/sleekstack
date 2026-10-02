/**
 * packages/query/src/select.ts
 *
 * `select`: an Effect-valued projection of a query (a DTO -> Model step such as `Model.fromDto`). It runs
 * in the reading store, so its requirements resolve from that scope, and re-runs only when the data
 * reference changes: an intermediate atom projects the data as `Data.tuple(data)` (an `Option` would run
 * as an Effect atom), which is `Equal` for the same reference, so a revalidation does not re-select.
 */

import { Atom, Result } from '@sleekstack/core'
import { Data, Effect, Option } from 'effect'
import type { QueryAtom } from './query'

/**
 * Builds a selector over query atoms.
 *
 * @param f - Maps the data to the selected value; its requirements resolve from the reading store's scope.
 * @returns `(query) => atom` (one atom per query). The atom is `Initial`/`Failure` while the query has no data,
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
      const data = Atom.make((get) => {
        const r = get(query)
        const value = Result.value(r)
        return Option.isSome(value) ? Data.tuple(value.value) : r
      })
      selected = Atom.make((get) => {
        const d = get(data)
        if ('_tag' in d) return Result.isFailure(d) ? Result.failure(d.cause) : Result.initial(d.waiting)
        return Atom.make(f(d[0])).read(get)
      })
      memo.set(query, selected)
    }
    return selected as Atom.Atom<Result.Result<B, E | Atom.ScopeError>>
  }
}
