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
/** Dev-only client query event buffer: `sample`, `events`, `record`, `clear` (for `@sleekstack/devtools`). */
export * as QueryEvents from './events'
/** SSR: `hydratable`, `prefetch`, `dehydrate`, `hydrate`, `apply`, `Dehydrated`. */
export * as Hydrate from './hydrate'
