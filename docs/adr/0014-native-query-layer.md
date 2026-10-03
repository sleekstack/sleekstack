# Queries and mutations are built on native atoms, in `@sleekstack/query`

`@sleekstack/query` is SleekStack's server-state cache. A query is a family of writable atoms on the native `AtomStore` (ADR 0008): reading an atom runs its fetch Effect (or Stream), and writing it seeds data. Its requirements are Tags resolved from the query store's scope, its failures are typed, and its cache is disposed with that scope. A per-store registry (key, `updatedAt`, observers) holds staleness and serves invalidation, so neither `Atom` nor `Result` changes. `Mutation.make` is a scoped Effect runner with optimistic writes and ordered rollback. React hooks are in `@sleekstack/react`, a dependency-inferred facade (`cachedQuery`, `mutation`) is in `@sleekstack/kit`, and server `prefetch` is in `@sleekstack/next`. This supersedes the earlier planning note that SleekStack would not do TanStack Query packages: we ship no TanStack adapter, we ship our own layer and document the mapping.

## Considered options

- **Wrap TanStack Query**: rejected. It is a second cache with a second lifecycle beside our scopes, and its Promise boundary loses `R` and `E`.
- **A standalone `QueryClient` store**: rejected. It duplicates the atom store, and `Result.waiting` already expresses stale-while-revalidate.
- **Cache policy inside `Atom`**: rejected. `Atom` stays a general primitive.
- **Query atoms plus a registry, in a separate package** *(chosen)*.

## Consequences

- Queries use the app-scoped store (the root `LayerProvider`'s, or the nearest `QueryProvider`'s); nested providers share it.
- `staleTime` gates only a new observer's refetch, `refetchOn` sources and hydrated entries. `invalidate`, `refetch` and `refetchInterval` are forced. A mounted entry never refetches by itself.
- `gcTime` is the family's idle TTL, so it is per query definition, not per key. Removing a node interrupts its in-flight fetch.
- SSR covers query atoms only; other atoms stay client only (`AtomsClientOnly`). `prefetch` needs a `Hydrate.hydratable` Schema, and typed failures are sent only with `failures: true`. A lazy server read of a query that was not prefetched uses the configured runtime only, with no per-call `request` or `overrides` Layers, so a query that needs request-scoped services must be prefetched with them. Its result travels in a `useId`-keyed JSON script; a read first reached after that script renders is not transferred.
- `useMutation` throws `AtomsClientOnly` during a server render.
- The kit has no server prefetch, `HydrateQueries` or value codec yet, so kit queries fetch on the client only. Follow-up spec `fn-16-query-layer-follow-ups-kit-ssr-prefetch` tracks it, with a server-safe core `useMutation` and a `fetch(args, previous)` hook in `Query.make`.
- An unserializable key throws `InvalidQueryKey`; the kit reports it as `SleekStackError` `Unknown`, with no dedicated code. `@sleekstack/kit` depends on `@sleekstack/query`.
- The Analyzer reads query and mutation fetchers like action bodies. A key must be a function returning a tuple literal of literals and its own parameters; a parameter typed `any`, `unknown` or a union (string-literal unions too, `boolean` excepted) fails closed as `Computed`.
- Devtools keep client-side query events only: `QueryEvents` holds 50 events per kind, and recording is off in production and when `process` is not defined. `@sleekstack/devtools` depends on `@sleekstack/query`.
