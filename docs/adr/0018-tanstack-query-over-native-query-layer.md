# Queries use TanStack Query; `@sleekstack/query` is a thin bridge

Status: Accepted. Supersedes ADR 0014.

SleekStack no longer ships its own query engine. Queries and mutations are TanStack Query (`@tanstack/query-core`, and `@tanstack/react-query` in React). `@sleekstack/query` keeps only the bridge: `QueryClientTag`, a scoped `QueryClientLive` Layer whose client is unmounted and cleared with its scope, and `effectFn`, which lowers an Effect to a `queryFn` / `mutationFn` run with the services of the layer that built the client. React uses the official hooks under `QueryProvider`; `@sleekstack/next` prefetches with `prefetchQueries` and hands TanStack's dehydrated state to `HydrationBoundary`; `@sleekstack/kit` lowers `cachedQuery` / `mutation` to TanStack options; `@sleekstack/ui/query` bridges `QueryObserver` / `MutationObserver` to atoms.

## Why the owner reversed 0014

The native layer duplicated a mature library: keys, staleness, retries, garbage collection, infinite queries, optimistic updates, hydration and devtools all needed our own implementation, tests and docs, and still lagged TanStack in features and ecosystem (devtools, persisters, docs, user familiarity). The cost of a second cache beside our scopes is removed by giving the client the scope's lifetime.

## Accepted costs

- Query errors are untyped: an Effect failure reaches TanStack as a rejection, so `error` is not the Effect's `E`.
- `effectFn`'s `R` is not checked against the client's layer; `sleekstack check` does not read `effectFn` bodies (kit `cachedQuery` / `mutation` bodies are still checked). A missing Tag rejects at run time.
- Retry is a count or TanStack function, not a `Schedule`; refetch triggers are TanStack's (focus, reconnect, interval), not arbitrary `Stream`s.
- kit queries have no server prefetch.

## Consequences

- `Query`, `Queries`, `Mutation`, `Hydrate`, `QueryEvents`, `canonicalKey` and `InvalidQueryKey` are deleted, with the kit error codes `InvalidQueryKey`, `QueryDecodeFailed` and `NoServerRunner`.
- The devtools Queries tab reads the scope client's `QueryCache`.
