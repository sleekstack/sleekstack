/**
 * packages/query/src/index.ts
 *
 * @sleekstack/query: Effect-native queries on the native atom store.
 */

/** Query definitions: `make`, `infinite`, `fetchNext`, `fetchPrevious`, `select`, `observe`, `trigger`, `entries`, `QueryCache`. */
export * as Query from './infinite'
/** The query client service: `Queries` (Tag), `make`, filters. */
export * as Queries from './queries'
export { canonicalKey, InvalidQueryKey } from './key'
/** Mutations: `make`, `shared`, `runner`, `optimistic`. */
export * as Mutation from './mutation'
