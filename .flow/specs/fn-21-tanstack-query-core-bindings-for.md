## Goal & Context
<!-- scope: business -->

`@sleekstack/ui` host components can now re-render on atom changes (fn-19), but they have no way to load server data except an Effect service called once per render. TanStack Query's framework-agnostic core (`@tanstack/query-core`) already solves caching, deduping, staleness, retries, refetching and mutations, and every framework adapter is a thin binding over its `QueryObserver` / `MutationObserver`. Bind the real core to host components so a component can write `const q = yield* useQuery({ queryKey, queryFn })` and re-render when the result changes.

This is deliberately the real `@tanstack/query-core`, not `@sleekstack/query` (fn-12, the Effect-native query layer on atoms). The two coexist: this spec gives ui users TanStack's exact semantics and ecosystem; `@sleekstack/query` stays the Effect-typed option for React/Next. Neither depends on the other.

Depends on fn-19 (merged): atom hooks, `Store`, per-run render scopes.

## Architecture & Data Models
<!-- scope: technical -->

- **Entry point.** A subpath export `@sleekstack/ui/query` (file `packages/ui/src/query.ts`) so the base package keeps no TanStack dependency. `@tanstack/query-core` is a peer dependency (and a devDependency for tests), not a dependency.
- **Client as a Tag.** `QueryClientTag` is an `Effect.Tag` over `QueryClient`. `QueryClientLive(config?)` is a `Layer` that builds the client, calls `client.mount()`, and on scope close calls `client.unmount()` and `client.clear()`. Components get the client with `yield* useQueryClient()`. Because the Tag is a requirement, `sleekstack check` reports a component using the hooks under a mount layer that does not provide it.
- **Bridging an observer to re-renders.** fn-19 re-renders a component only when an atom it read changes, so each observed query result lives in a writable atom: the hook creates (or reuses) an observer entry holding `{ observer, atom }`, subscribes the observer so each result is written to the atom with `Store.set`, and reads the atom with `useAtomValue`. The component re-renders through the existing fn-19 path; nothing new is added to the renderer.
- **Observer identity across re-runs.** A host component re-run is a fresh call with no hook slots, so a naive new `QueryObserver` per run would refetch on every re-run (default `staleTime: 0` makes every new observer refetch on subscribe) and loop. Entries therefore live in a per-store registry keyed by the query hash and are reference counted by the run scopes that use them: a run acquires the entry in its per-run scope (fn-19's `RenderScope`), the previous run's scope is released only after the new run succeeded, so the count never reaches zero between re-runs and the observer persists. The last release unsubscribes and drops the entry. Each run calls `observer.setOptions` with the latest options (TanStack's own adapters do the same).
- **Dedupe.** Two components with the same key share one registry entry and the `QueryClient`'s own cache dedupes fetches; different options for one key follow TanStack's `setOptions` last-write rule (documented).
- **Mutations.** `useMutation(options)` follows the same pattern with a `MutationObserver` (one per run scope, no sharing: a mutation has no key identity), exposing `{ mutate, mutateAsync, ...result }`. `mutate` is a plain function, so it can be handed to a `fromReact` guest as a prop, the same way `useSetAtom`'s setter is.
- **Server render.** `renderToString` never subscribes and never starts a fetch: `useQuery` renders the result built from the cache's current data (`getQueryState`), so a caller that awaited `client.prefetchQuery` before rendering gets data in the HTML and an unprefetched query renders as `pending`. Observers made during a string render are destroyed with the run scope. Dehydrate / hydrate transport is not part of this spec.
- **Packages touched:** `@sleekstack/ui` (query module, package.json exports and peer), `@sleekstack/analyze` (only if the Tag requirement needs seeding; expected none), `apps/ui-demo` (a query-driven list), docs and ADR.

## API Contracts
<!-- scope: technical -->

```ts
// @sleekstack/ui/query
class QueryClientTag extends Effect.Tag('QueryClientTag')<QueryClientTag, QueryClient>() {}
QueryClientLive(config?: QueryClientConfig): Layer<QueryClientTag>
useQueryClient(): Effect<QueryClient, never, QueryClientTag>
useQuery<TData, TError>(options: QueryObserverOptions<...>): Effect<QueryObserverResult<TData, TError>, never, QueryClientTag | Store>
useMutation<TData, TError, TVars, TCtx>(options: MutationObserverOptions<...>): Effect<UseMutationResult<...>, never, QueryClientTag | Store>
```

- Option and result types are TanStack's own (re-exported types, no wrapper types). `useMutation`'s result is `MutationObserverResult` plus `mutate` and `mutateAsync`.
- `queryFn` stays a plain function returning a promise, as in TanStack; running an Effect inside it is the caller's business (a helper is out of scope).
- A query that errors is a result (`status: 'error'`), not an Effect failure. `throwOnError` is not supported in this spec (documented; passing it is a type error).
- `useQuery` outside a `mount` or `renderToString` fails like fn-19's hooks (a `MissingDependency` naming `Store`); a missing `QueryClientTag` is the usual unprovided-requirement error and is caught by `sleekstack check`.

## Edge Cases & Constraints
<!-- scope: technical -->

- Changing a component's `queryKey` between re-runs acquires a new entry and releases the old one (old observer unsubscribed once the new run succeeded).
- A re-run that fails keeps the previous run's scope, hence its entries, alive (fn-19's scope rule), so the cache subscription is not dropped by a failing render.
- `dispose` / a superseding `mount` closes every run scope, which releases every entry and unsubscribes every observer; the client is unmounted by the Layer scope, never by the hooks.
- Focus and online refetching rely on the browser APIs `QueryClient.mount()` already uses; under jsdom tests they are inert.
- Result updates written while no run is mounted for that entry are dropped with the entry; cache data stays in the `QueryClient`.
- The per-store registry is a `WeakMap` keyed by the `AtomStore`, so a store passed via `mount`'s `store` option shares entries across mounts only if the same client is provided.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `QueryClientLive` provides a `QueryClient` that is mounted while the layer scope is open and unmounted and cleared when it closes. Errors: a failing config function fails the layer with the original error; no error surface beyond that.
- **R2:** `useQuery` renders the current result under `mount`, and a resolved fetch re-renders only the components that read that query. Errors: a rejected `queryFn` renders `status: 'error'` after TanStack's retries (tests set `retry: false`); never an Effect failure.
- **R3:** Observer identity persists across re-runs: a component that re-renders because of an unrelated atom change does not start a new fetch, and with `staleTime: 0` the fetch count stays at one. Errors: none beyond R2.
- **R4:** Two components using the same key share one entry and cause one fetch; the entry is dropped (observer unsubscribed) when the last using scope closes. Errors: none beyond R2.
- **R5:** `useMutation` exposes `mutate` / `mutateAsync` and reactive status; calling `mutate` from a `fromReact` guest prop updates the reading component. Errors: a failing `mutationFn` yields `status: 'error'`; `mutateAsync` rejects with the original error.
- **R6:** `renderToString` starts no fetch and subscribes to nothing: a prefetched query renders its data, an unprefetched one renders `pending`. Errors: none.
- **R7:** `dispose` and a superseding `mount` unsubscribe every observer and leave no pending timers from this module; the client is unmounted by its layer, not by `dispose`. Errors: no error surface beyond R1.
- **R8:** `sleekstack check` reports a component using `useQuery` under a mount layer that does not provide `QueryClientTag` (`MissingDependency`), and is clean when provided. Errors: no new error code.
- **R9:** `apps/ui-demo` shows a query-driven list with a mutation triggered from a guest, with a jsdom test using a fake `queryFn`. Errors: none.
- **R10:** ADR amendment records the decision (real `query-core`, observers bridged through atoms, per-store ref-counted entries, no `throwOnError`); ui README documents the `@sleekstack/ui/query` entry. Errors: none.

## Boundaries
<!-- scope: business -->

- No Effect-typed `queryFn`, error channel or retry; that is `@sleekstack/query`'s job.
- No dehydrate / hydrate transport, no SSR prefetch helper, no streaming.
- No infinite queries, `useQueries`, suspense mode or `throwOnError`.
- No devtools integration and no persistence.
- No dependency from `@sleekstack/query` on this module or the reverse.
- No change to the renderer; only the fn-19 hooks and scopes are used.

## Decision Context
<!-- scope: both -->

- **Real `@tanstack/query-core` over `@sleekstack/query`** (user decision): exact TanStack semantics and ecosystem; accepted cost is a second cache beside atoms and promise-typed `queryFn`s.
- **Bridge through atoms**: fn-19 already re-renders on atom changes, so the observer writes its result to an atom instead of adding a second subscription path to the renderer.
- **Ref-counted per-store entries**: components have no instance slots, and a fresh observer per re-run would refetch on every re-run. The fn-19 scope rule (release the previous run only after the next succeeded) is what makes the count stable.
- **Subpath export with a peer dependency**: keeps `@sleekstack/ui` free of TanStack for users who do not use it.
- **Rejected: adapter interface over both engines**: no current need to swap engines; add it if a second consumer appears.
- **Rejected: an Effect `queryFn` helper now**: easy to add later and not needed to prove the binding.
