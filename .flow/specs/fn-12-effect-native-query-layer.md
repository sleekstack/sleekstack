## Goal & Context
<!-- scope: business -->

TanStack Query is the reference for server-state in React: a keyed cache of async results with staleness, dedupe, retries, invalidation, mutations, pagination and SSR hydration. It is Promise-based, owns its own `QueryClient` lifecycle beside our scopes, and cannot see Effect services, typed errors or the SleekStack graph. `@sleekstack/query` is the Effect-native counterpart: a query is an Effect (or Stream) keyed in the existing native atom store, so its requirements are Tags resolved from the component/request scope, its failures are typed, and its lifetime ends with the scope. Users who want a familiar `useQuery` / `useMutation` surface get one without a second runtime.

It builds on the native atoms (`Atom`, `Result`, `AtomStore`, ADR 0008), not on TanStack. SSR hydration is new ground: atoms are client-only today (`AtomsClientOnly`), so this spec also defines the server prefetch and hydration contract for query atoms only.

Positioning (supersedes the earlier "not doing TanStack Query packages" note): we do not ship an adapter for TanStack Query; we ship our own query layer and document the mapping for TanStack users.

## Architecture & Data Models
<!-- scope: technical -->

- **Package `@sleekstack/query`** (framework-free core: depends on `effect` and `@sleekstack/core`). React hooks live in `@sleekstack/react` (like atoms); an Effect-free facade lives in `@sleekstack/kit` (dependency-array-free, Tags inferred like `defineEffect`).
- **Query atom shape.** A query is a writable atom whose read runs the fetch and whose `setSelf` path seeds data (used by `setData`, optimistic writes and hydration), so no `AtomStore` change is needed. Family lookup uses a canonical string key (stable JSON with sorted object keys; the tuple is kept only for prefix matching), because `Atom.family` compares by `Hash`/`Equal` and plain arrays are reference-compared.
- **Query = keyed atom family.** `Query.make({ key, fetch, staleTime, gcTime, retry, refetchOn })` returns a family `(args) => Atom<Result<A, E>>`. `key` is a stable serializable tuple; `fetch: (args) => Effect<A, E, R>` (or `Stream` for live queries). Requirements `R` are resolved from the scope's Context exactly like `Atom.make(effect)`. `Result` already carries `waiting` (fetching without losing the last value); `staleTime` / `gcTime` map onto `idleTTL` / `keepAlive`.
- **Cache policy** in a small `QueryCache` service (a Tag, replaceable in tests): dedupe of concurrent fetches per key, `staleTime` (fresh reads never refetch), `gcTime` (evict after last subscriber), `retry` as an Effect `Schedule`, refetch triggers (mount, window focus, reconnect, interval) as pluggable `Stream` sources so the core has no DOM dependency.
- **QueryCache registry.** `AtomStore` has no way to enumerate nodes, so the `QueryCache` keeps a per-store registry (canonical key -> `{ atom, updatedAt, observers }`) filled when a query is read and cleared by finalizers. Prefix/predicate invalidation, `getData` and stale timestamps all live here; `Result` is not extended. A mounted node never refetches by itself: `staleTime` governs triggers (mount, focus, reconnect, non-forced invalidate) and hydrated entries. `gcTime` maps to the family's `idleTTL`, so it is per family, not per key, and an in-flight fetch is interrupted when the node is removed (up to `gcTime` after the last observer leaves).
- **Store placement.** Each `LayerProvider` scope has its own `AtomStore`, so queries and the `Queries` service resolve to the nearest app-scoped store (the root provider or an explicit `QueryProvider` marker); nested providers share it, and `invalidate` from a child reaches the parent's entries. `<HydrateQueries>` seeds that store.
- **Invalidation and direct writes**: `QueryClient`-equivalent service `Queries` with `invalidate(filter)`, `refetch`, `setData(key, updater)`, `getData`, `cancel`, `reset`. Filters match by key prefix or predicate. Invalidation is push (marks stale and refetches subscribed queries), reusing the store's push invalidation.
- **Mutation = scoped Effect runner.** `Mutation.make({ run, onMutate, onSuccess, onError, onSettled })` yields an atom-backed state machine (`idle | pending | success | failure`) with `mutate`, `reset`. Optimistic updates: `cancel(key)` runs before `onMutate`, which returns a rollback Effect; failure or interruption runs it, and overlapping rollbacks run in reverse order. State and concurrency are per hook instance by default (`Mutation.shared` opts into a shared/keyed state). `onMutate` runs in the event handler, never in an effect. Concurrency mode: `switch | queue | parallel`. A Draft's `toDto` Effect (Model/Draft pattern) is a valid `run` input.
- **Infinite / paginated queries**: `Query.infinite({ key, fetchPage, getNextParam, getPreviousParam, maxPages })` keeps `pages` + `pageParams` in one atom value, with `fetchNext` / `fetchPrevious` and a `Result`-level `isFetchingNext`. Refetch re-runs pages sequentially from the first.
- **Select / Models**: `select: (a) => Effect<B, never, R2>` runs after fetch and is memoised on data identity, so `Model.fromDto` (which resolves its own context from services) plugs in directly; the cached value is the DTO, the selected value is the Model.
- **Suspense**: hooks do not suspend by default; `useQuerySuspense` (or `{ suspense: true }`) suspends only on `Initial`, never on a background refetch, and a `Failure` that still has a previous value returns the stale data plus the error instead of throwing.
- **SSR prefetch and hydration**: server side, `prefetch(queries)` runs query Effects in the request scope through the Next runtime (`runEffect`) and returns a serializable `Dehydrated` (`[{ key, result, updatedAt }]`); values are encoded with a `Schema` (required; DTO-only plain JSON by default), and typed failures are opt-in. Hydrating into an already-mounted key keeps whichever entry has the newer `updatedAt`. Server query hooks take a separate branch that reads the dehydrated map from context (no store, so no `AtomsClientOnly`); an un-prefetched key on the server suspends on a fetch started through `runEffect`. Client side, `<HydrateQueries state>` seeds the store before first render; hydrated entries are fresh until `staleTime`. Atom hooks stay client-only for non-query atoms; query hooks read server-rendered data without throwing `AtomsClientOnly` when hydrated. Streaming: a Suspense read on the server awaits the prefetch promise instead of starting a fetch.
- **Devtools**: query entries (key, state, observers, updatedAt, gc timer) are emitted to `@sleekstack/devtools`' bounded event buffer; the panel gets a Queries tab. No client-bundle cost without the dev-only entry.
- **Analyzer**: `Query.make` / `Mutation.make` fetchers are read like action bodies (types not syntax): `R` from the Effect requirements, so a query requiring an unprovided Tag is a build error with file:line. `key` is static when it is a function returning a tuple literal of literals and parameters; anything else is `Computed` (fail closed).
- **Decision Context**: rejected wrapping TanStack Query (second cache, second lifecycle, Promise boundary loses `R`/`E`); rejected a standalone `QueryClient` store (duplicates atoms; the `Result.waiting` model already expresses stale-while-revalidate); rejected putting policy inside `Atom` (keeps `Atom` a general primitive).

## API Contracts
<!-- scope: technical -->

```ts
// @sleekstack/query
const todo = Query.make({
  key: (id: string) => ['todo', id] as const,
  fetch: (id) => Effect.flatMap(TodoApi, (api) => api.get(id)),  // R = TodoApi
  staleTime: '30 seconds',
  gcTime: '5 minutes',
  retry: Schedule.exponential('100 millis').pipe(Schedule.compose(Schedule.recurs(3))),
})
const rename = Mutation.make({
  run: (input: RenameInput) => Effect.flatMap(TodoApi, (api) => api.rename(input)),
  onMutate: (input) => Queries.setData(todo, input.id, (t) => ({ ...t, title: input.title })), // returns rollback
  onSettled: (input) => Queries.invalidate(todo, input.id),
})

// @sleekstack/react
const { data, error, isFetching, refetch } = useQuery(todo('t1'))        // suspends/throws like useService when asked
const { mutate, isPending } = useMutation(rename)
<HydrateQueries state={dehydrated} />

// @sleekstack/next (server)
const dehydrated = await prefetch([todo('t1')])
```

- Hooks return plain values; `Result` is available via `useQueryResult`. Error channel `E` is typed; scope errors (`MissingDependency`, `PrivateDependency`) join it like atoms.
- `@sleekstack/kit` exposes the same with dependency inference (`defineQuery`-style naming to avoid clashing with the Next `query`; final names decided in the naming task using CONTEXT.md vocabulary).
- TSDoc `@throws` names adapter functions, not core error names.

## Edge Cases & Constraints
<!-- scope: technical -->

- Same key from two scopes: caches are per `AtomStore` (component scope); a query needing sharing is provided from an app-scoped store. Shadowing a service does not invalidate cached entries; documented.
- Keys must be JSON-serializable and stable; a non-serializable key (function, BigInt, cycle) is a runtime `InvalidQueryKey`, and a non-static key function is a static `Computed` error.
- `setData` on a missing key creates the entry; `getData` on a missing key returns `Option.none`; `cancel` during a retry stops the schedule; retry plus interval refetch never overlaps (dedupe covers both); a Stream query ignores `staleTime` and retries per its own stream; `reset` restores `Initial` and drops the registry entry; disposing a store while a mutation runs interrupts it (documented).
- RSC-rendered props and the query cache must not be two sources of truth: in the showcase the query cache owns client reads, RSC only prefetches/hydrates, and `router.refresh()` is removed from mutation paths.
- The dev event buffer is server-only; client query events use a separate client-side ring buffer with per-kind caps so focus/interval refetches cannot evict everything else.
- Interruption: unmounting the last observer interrupts the in-flight fetch after `gcTime`; a mutation in flight is never interrupted by unmount unless `interruptOnUnmount` is set.
- StrictMode double mount must not double-fetch (dedupe by key) or double-run `onMutate`.
- Hydration mismatch: a hydrated entry with a different key encoding is dropped and refetched, never partially applied.
- Retry only re-runs typed failures by default, never defects or interruption.
- Not in scope: persistence (localStorage/IndexedDB), offline mutation queue, React Native focus/online managers, TanStack Start / React Router hydration adapters (they reuse `prefetch` later), non-React frameworks.

## Acceptance Criteria
<!-- scope: business -->

- **R1:** `Query.make` returns a keyed family (canonical string key; two fresh equal arrays hit one atom) whose reads dedupe concurrent fetches, honour `staleTime` (for triggers and hydrated entries) and `gcTime`, and expose `waiting` while revalidating. Errors: a failed fetch yields a typed `Result.Failure`; a missing service yields `MissingDependency`; a non-serializable key throws `InvalidQueryKey`.
- **R2:** Retry via `Schedule` and refetch triggers (mount, focus, reconnect, interval) work through pluggable sources; no DOM access in the core package.
- **R3:** `Queries.invalidate/refetch/setData/getData/cancel/reset` work by key prefix and predicate; invalidating refetches subscribed queries only.
- **R4:** `Mutation.make` supports optimistic updates with rollback on failure or interruption, and `switch | queue | parallel` concurrency. Overlapping mutations on one key roll back in reverse order and never wipe a later optimistic write. Errors: `onMutate` failure aborts the mutation before `run`; `cancel` precedes `onMutate`.
- **R5:** `Query.infinite` supports next/previous pages, `maxPages`, and sequential refetch. Errors: a failing page keeps prior pages and reports the failure.
- **R6:** `select` accepts an Effect with requirements (Model `fromDto` compatible) memoised on data identity.
- **R7:** `prefetch` + `<HydrateQueries>` render server data on first paint with no client refetch until stale; hydrating a mounted key keeps the newer `updatedAt`; nested providers share one query store; a mismatched key is dropped. Errors: prefetch failure is not dehydrated unless opted in; a value that fails its `Schema` is dropped and refetched.
- **R8:** `useQuery` / `useMutation` in `@sleekstack/react` and the facade in `@sleekstack/kit` pass StrictMode tests (no double fetch); kit's public d.ts never references effect or `@sleekstack/(core|next|react|query)`.
- **R9:** The analyzer reports a query/mutation whose fetcher requires an unprovided Tag, and fails closed on a non-static key function (not a tuple literal of literals and parameters), with file:line.
- **R10:** Devtools shows query entries (from a client-side buffer) in dev and they are absent from production client chunks. Errors: empty buffer renders an empty state.
- **R11:** Showcase (`apps/showcase`) replaces its `router.refresh()` reads with queries + mutations using Models/Drafts, and `apps/showcase-kit` uses the kit facade; both test suites and e2e pass.
- **R12:** ADR (query layer on atoms; supersedes the "no TanStack Query package" note), CONTEXT.md terms, READMEs, docs guides and a TanStack-to-SleekStack mapping page are written; docs tests pass.

## Quick commands
```bash
pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test
pnpm --filter showcase typecheck && pnpm --filter showcase test
```

## Early proof point
Task 1 (core `Query.make` on atoms: dedupe + staleTime + gcTime + waiting) validates that stale-while-revalidate and dedupe fit the existing `AtomStore` push invalidation without changes to `Atom`. If it needs store changes beyond an `idleTTL` hook, stop and re-evaluate keeping cache policy in a separate `QueryCache` store.

## Boundaries
<!-- scope: business -->

Builds on fn-11 (Layer-based runtime, `runEffect`, devtools buffer): tasks 1-8 and 10 need only what fn-11.1-5 shipped, so there is no spec-level dependency; the devtools task (9) is blocked on fn-11.6 and the docs task (11) on fn-11.7 (they edit the same files; each task tells the worker to check first, since flowctl task deps cannot cross specs). Does not change `Atom`'s public API beyond additive hooks. No dependency on `@tanstack/*`.

## Ordering
<!-- scope: technical -->

1. Core query cache on atoms: query atom shape, canonical keys, QueryCache registry (R1, R2) — proof point.
2. Invalidation client + direct writes (R3).
3. Mutations with optimistic updates (R4).
4. Infinite queries (R5) and select/Models (R6), parallel after 2.
5. React hooks + StrictMode (R8, first half).
6. SSR prefetch + hydration in next/react (R7).
7. Kit facade + dts boundary (R8, second half).
8. Analyzer support (R9) and devtools (R10), parallel after 5.
9. Showcase adoption (R11).
10. ADR, docs, mapping page (R12).

## Decision Context
<!-- scope: business -->

Chosen: query layer on native atoms in a new package, hooks in react, facade in kit, all v1 scope (queries, mutations, invalidation, infinite, SSR hydration, devtools, Model/Draft integration). Rejected: TanStack wrapper, standalone client. Risk: SSR hydration is the largest unknown (atoms have no SSR); it is sequenced after the client story so a slip does not block queries/mutations.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `Query.make` returns a keyed family (canonical string key; two fresh equal arrays hit one atom) whose reads dedupe concurrent fetches, honour `staleTime` (for triggers and hydrated entries) and `gcTime`, and expose `waiting` while revalidating. Errors: a failed fetch yields a typed `Result.Failure`; a missing service yields `MissingDependency`; a non-serializable key throws `InvalidQueryKey`. | fn-12-effect-native-query-layer.1 | — |
| R2 | Retry via `Schedule` and refetch triggers (mount, focus, reconnect, interval) work through pluggable sources; no DOM access in the core package. | fn-12-effect-native-query-layer.1 | — |
| R3 | `Queries.invalidate/refetch/setData/getData/cancel/reset` work by key prefix and predicate; invalidating refetches subscribed queries only. | fn-12-effect-native-query-layer.2 | — |
| R4 | `Mutation.make` supports optimistic updates with rollback on failure or interruption, and `switch \| queue \| parallel` concurrency. Overlapping mutations on one key roll back in reverse order and never wipe a later optimistic write. Errors: `onMutate` failure aborts the mutation before `run`; `cancel` precedes `onMutate`. | fn-12-effect-native-query-layer.3 | — |
| R5 | `Query.infinite` supports next/previous pages, `maxPages`, and sequential refetch. Errors: a failing page keeps prior pages and reports the failure. | fn-12-effect-native-query-layer.4 | — |
| R6 | `select` accepts an Effect with requirements (Model `fromDto` compatible) memoised on data identity. | fn-12-effect-native-query-layer.4 | — |
| R7 | `prefetch` + `<HydrateQueries>` render server data on first paint with no client refetch until stale; hydrating a mounted key keeps the newer `updatedAt`; nested providers share one query store; a mismatched key is dropped. Errors: prefetch failure is not dehydrated unless opted in; a value that fails its `Schema` is dropped and refetched. | fn-12-effect-native-query-layer.6 | — |
| R8 | `useQuery` / `useMutation` in `@sleekstack/react` and the facade in `@sleekstack/kit` pass StrictMode tests (no double fetch); kit's public d.ts never references effect or `@sleekstack/(core\|next\|react\|query)`. | fn-12-effect-native-query-layer.5, fn-12-effect-native-query-layer.7 | — |
| R9 | The analyzer reports a query/mutation whose fetcher requires an unprovided Tag, and fails closed on a non-static key function (not a tuple literal of literals and parameters), with file:line. | fn-12-effect-native-query-layer.8 | — |
| R10 | Devtools shows query entries (from a client-side buffer) in dev and they are absent from production client chunks. Errors: empty buffer renders an empty state. | fn-12-effect-native-query-layer.9 | — |
| R11 | Showcase (`apps/showcase`) replaces its `router.refresh()` reads with queries + mutations using Models/Drafts, and `apps/showcase-kit` uses the kit facade; both test suites and e2e pass. | fn-12-effect-native-query-layer.10 | — |
| R12 | ADR (query layer on atoms; supersedes the "no TanStack Query package" note), CONTEXT.md terms, READMEs, docs guides and a TanStack-to-SleekStack mapping page are written; docs tests pass. | fn-12-effect-native-query-layer.11 | — |

