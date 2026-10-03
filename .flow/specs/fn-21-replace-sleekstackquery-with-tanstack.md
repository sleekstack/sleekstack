## Goal & Context
<!-- scope: business -->

Replace `@sleekstack/query` (the Effect-native query layer on atoms, fn-12 / ADR 0014) with TanStack Query's framework-agnostic core, `@tanstack/query-core`, across the stack, and bind it to `@sleekstack/ui` host components. One query engine, the one with the ecosystem: one cache semantics, existing docs, official React / devtools knowledge transfers, and ui gets `useQuery` / `useMutation` for free from the same core.

ADR 0014 rejected wrapping TanStack ("a second cache with a second lifecycle beside our scopes, and its Promise boundary loses `R` and `E`"). That decision is reversed by the owner. The costs it named are accepted and mitigated in this spec: the cache lives in a `QueryClient` whose lifetime is a Layer scope (R1), and DI is kept by an Effect-to-`queryFn` helper that runs the Effect with the app's services (R2). Effect-typed query failures (`E` in the type) are given up; errors are TanStack's `TError`.

This is a breaking change to private, pre-1.0 workspace packages: no compatibility shims, `@sleekstack/query` is deleted. Depends on fn-19 (merged). Obsoletes fn-16 (kit SSR prefetch for the old layer); that spec should be closed when this one is planned.

## Architecture & Data Models
<!-- scope: technical -->

- **Shared bridge in core.** A new subpath `@sleekstack/core/query` (peer dependency `@tanstack/query-core`) holds the only SleekStack-specific pieces: `QueryClientTag` (an `Effect.Tag` over `QueryClient`), `QueryClientLive(config?)` (a `Layer` that builds the client, `mount()`s it, and on scope close `unmount()`s and `clear()`s it), and `effectFn(effect)` (below). React, Next, kit, ui and devtools all import these; none of them imports another's query code.
- **DI kept: `effectFn`.** `effectFn(effect)` returns a `queryFn` / `mutationFn` that runs `effect` with the `Context` the client's layer was built in (captured by `QueryClientLive`), honoring the `AbortSignal` TanStack passes (interrupting the fiber) and rejecting with the original failure value (so a tagged error is the query's `error`). A query body can therefore `yield* SomeTag` exactly as kit's `cachedQuery` bodies do today. Plain promise `queryFn`s stay valid.
- **React (`@sleekstack/react`).** Hooks come from the official `@tanstack/react-query` (peer dependency); `@sleekstack/react` stops shipping its own `useQuery` / `useMutation` / `HydrateQueries`. It adds `QueryProvider`, which reads `QueryClientTag` from the app scope and renders TanStack's `QueryClientProvider` (so one client per `LayerProvider` root, disposed with its scope). SSR hydration uses TanStack's `dehydrate` / `HydrationBoundary`.
- **Next (`@sleekstack/next`).** `prefetchQueries(...)` runs inside the request-scoped `runEffect`, takes the client from the request scope, awaits `prefetchQuery` for the given options, and returns `dehydrate(client)` for the page to pass to `HydrationBoundary`; the client is disposed with the request scope.
- **Kit (`@sleekstack/kit`).** The Effect-free facade (`cachedQuery`, `mutation`, kit react hooks) is re-expressed over the same pieces: a kit query definition lowers to `queryOptions` with an `effectFn` body, kit hooks re-export the react-query hooks bound to the kit's scope. The existing public names are kept where their meaning survives; the exact surface is settled in the kit task by reading `packages/kit/src/query.ts` and its tests, and any name that cannot survive is removed, not shimmed.
- **ui (`@sleekstack/ui/query`).** The binding specified in "UI bindings" below.
- **Devtools.** The queries panel reads the client's `QueryCache` (subscribe for events, `getAll` for the snapshot) instead of the removed `QueryEvents` buffer; production gating is kept.
- **Showcase and docs.** The showcase board query layer is rewritten in TanStack idioms (optimistic update via `onMutate` and rollback via `onError`, invalidation on settle), keeping its tests and e2e green. `apps/docs` queries guide and snippets are rewritten; docs tests keep passing.
- **Removal.** `packages/query` and every `@sleekstack/query` dependency, import, doc mention and lockfile entry are deleted. ADR 0014 is marked superseded by a new ADR recording this reversal; `CONTEXT.md` and READMEs updated. The Analyzer's reads of query fetchers (`FETCHER_CALLS`, `kit/query#cachedQuery`) are removed or retargeted to what remains.

### UI bindings

- **Bridging an observer to re-renders.** fn-19 re-renders a component only when an atom it read changes, so each observed query result lives in a writable atom: the hook obtains an entry `{ observer, atom }`, the observer's subscription writes each result to the atom with `Store.set`, and the component reads it with `useAtomValue`. The renderer is unchanged.
- **Observer identity across re-runs.** A re-run is a fresh call with no hook slots, so a new `QueryObserver` per run would refetch every time (`staleTime: 0` refetches on subscribe) and loop. Entries live in a per-store registry keyed by query hash and are reference counted by run scopes (fn-19's `RenderScope`): a run acquires an entry in its scope, and the previous run's scope is released only after the new run succeeded, so the count never hits zero between re-runs. The last release unsubscribes and drops the entry. Each run calls `observer.setOptions` with the latest options.
- **Mutations.** `useMutation` uses a `MutationObserver` per run scope (no sharing) and exposes `mutate` / `mutateAsync` plus the reactive result; `mutate` is a plain function that can be passed to a `fromReact` guest.
- **Server render.** `renderToString` never subscribes or fetches: `useQuery` renders from the cache's current state (prefetched data, else `pending`).

## API Contracts
<!-- scope: technical -->

```ts
// @sleekstack/core/query
class QueryClientTag extends Effect.Tag('QueryClientTag')<QueryClientTag, QueryClient>() {}
QueryClientLive(config?: QueryClientConfig): Layer<QueryClientTag>
effectFn<A, E, R>(effect: Effect<A, E, R>): (ctx?: { signal?: AbortSignal }) => Promise<A>   // R must be satisfied by the client layer's context

// @sleekstack/ui/query
useQueryClient(): Effect<QueryClient, never, QueryClientTag>
useQuery<TData, TError>(options: QueryObserverOptions<...>): Effect<QueryObserverResult<TData, TError>, never, QueryClientTag | Store>
useMutation<TData, TError, TVars, TCtx>(options: MutationObserverOptions<...>): Effect<MutationObserverResult<...> & { mutate; mutateAsync }, never, QueryClientTag | Store>

// @sleekstack/react
<QueryProvider>{children}</QueryProvider>            // QueryClientProvider fed from QueryClientTag in the app scope
// @sleekstack/next
prefetchQueries(optionsList, runOptions?): Promise<DehydratedState>
```

- Option and result types are TanStack's own. A query that errors is a result (`status: 'error'`), not an Effect failure; `throwOnError` is not supported in ui.
- `effectFn`'s requirement `R` is not checked by tsc against the client layer; `sleekstack check` is the check where it can read it, and an unsatisfied Tag fails at run time with the usual missing-Tag error rejecting the promise.

## Edge Cases & Constraints
<!-- scope: technical -->

- One `QueryClient` per layer scope; two roots get two caches, as today's two stores do.
- `effectFn` aborts: TanStack's `signal` abort interrupts the Effect fiber; an Effect that completes after abort is ignored.
- Changing a ui component's `queryKey` between re-runs acquires a new entry and releases the old one after the new run succeeded; a failing re-run keeps the previous scope alive (fn-19 rule).
- Query keys no longer go through `canonicalKey` / `InvalidQueryKey`; TanStack's hashing applies (documented difference).
- Hydration payloads change shape (TanStack `DehydratedState`); there is no persisted wire format to migrate.
- Tests that read the build-generated `.sleekstack` report must keep not doing so (existing showcase rule).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `QueryClientLive` provides a client that is mounted while its layer scope is open and unmounted and cleared when it closes. Errors: a failing config function fails the layer with the original error.
- **R2:** `effectFn` runs an Effect with the services of the client's layer, resolves with its success value, rejects with the original failure value (a tagged error stays a tagged error), and interrupts the fiber when the `AbortSignal` aborts. Errors: a missing Tag rejects with the standard missing-dependency error; a defect rejects with the defect.
- **R3:** React: `QueryProvider` supplies the scope's client to `@tanstack/react-query` hooks, one client per `LayerProvider` root, closed with the root scope; `@sleekstack/react` no longer exports its own query hooks or `HydrateQueries`. Errors: no error surface beyond R1.
- **R4:** Next: `prefetchQueries` returns a dehydrated state containing the prefetched queries and disposes its client with the request scope; a failing prefetch follows TanStack's `prefetchQuery` rule (does not throw) and the entry is absent. Errors: a failure to build the request scope rejects like `runEffect`.
- **R5:** Kit: `cachedQuery` / `mutation` and the kit react hooks work over the new pieces with the kit's existing tests ported and green; bodies still resolve Tags with `yield*`. Errors: kit's error normalization is preserved for rejected `effectFn` failures.
- **R6:** Devtools: the queries panel lists queries and their events from the client's `QueryCache`, and shows nothing in production as before. Errors: no client in scope shows the panel's existing empty state.
- **R7:** ui: `useQuery` renders the current result under `mount`, a resolved fetch re-renders only components that read that query, and a rejected `queryFn` renders `status: 'error'` (tests use `retry: false`). Errors: never an Effect failure; a missing `QueryClientTag` is caught by `sleekstack check` (R10).
- **R8:** ui: observer identity persists across re-runs (an unrelated atom change causes no new fetch with `staleTime: 0`), two components with one key share one entry and one fetch, and the entry is dropped when the last using scope closes. Errors: none beyond R7.
- **R9:** ui: `useMutation` exposes `mutate` / `mutateAsync` and reactive status, a guest prop calling `mutate` updates the reader; `renderToString` starts no fetch (prefetched data renders, otherwise `pending`); `dispose` / a superseding `mount` leaves no observers or timers from this module. Errors: a failing `mutationFn` yields `status: 'error'`, `mutateAsync` rejects with the original error.
- **R10:** `sleekstack check` reports a component using a query hook under a mount layer that does not provide `QueryClientTag` (`MissingDependency`) and is clean when provided; the Analyzer no longer references the removed query layer. Errors: no new error code.
- **R11:** Showcase and docs compile, their tests and e2e pass on the new layer, and `apps/ui-demo` shows a query-driven list with a mutation from a guest (jsdom test with a fake `queryFn`). Errors: none.
- **R12:** `packages/query` is deleted and no reference to `@sleekstack/query` remains in code, package manifests, lockfile, docs or CONTEXT (a repo grep returns only ADR history); ADR 0014 is marked superseded by the new ADR. Errors: none.

## Boundaries
<!-- scope: business -->

- No Effect-typed query failures (`E` in the type) and no Effect-native cache: given up on purpose.
- No new SSR transport beyond TanStack's dehydrate / hydrate; atom SSR (fn-17) is untouched.
- No infinite queries, `useQueries`, suspense mode or `throwOnError` in ui.
- No compatibility layer or deprecation period for `@sleekstack/query`.
- No change to the ui renderer; only fn-19's hooks and scopes are used.
- No devtools features beyond parity with today's panel.

## Decision Context
<!-- scope: both -->

- **Replace over coexist** (owner decision, after choosing real `query-core` over binding the existing layer): one engine, no second query story to document or maintain.
- **Tag and Layer in `@sleekstack/core/query`**: every consumer already depends on core, and a peer dependency keeps TanStack out of users who never import the subpath.
- **Official `@tanstack/react-query` for React**: the framework adapter is already the maintained binding; we only bridge the client's lifetime.
- **`effectFn` instead of dropping DI**: kit's query bodies resolve Tags from the scope, and losing that would remove the reason to have queries inside SleekStack at all.
- **Bridge ui through atoms and ref-counted entries**: fn-19 already re-renders on atom changes; a per-re-run observer would refetch in a loop, so observers are shared per store and released by scope.
- **Rejected: keep `@sleekstack/query` beside it**: owner chose replacement; two layers double the surface.
- **Rejected: an engine adapter interface**: no second engine is planned.
