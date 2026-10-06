# 0025. `@sleekstack/ui` does not depend on `@sleekstack/query`

## Status

Accepted. Amends ADR 0018, which put the ui bridge at `@sleekstack/ui/query`.

## Context

`@sleekstack/ui` imported `@sleekstack/query` and TanStack for two things: the query hooks (`ui/query`) and, in `renderToString`, `renderToStream` and `hydrateMount`, the dehydrate / hydrate of the scope's `QueryClient`. The renderer should not know any data library, and every ui user carried a TanStack peer dependency.

## Decision

- **Extension point.** `@sleekstack/ui` exports `Transfer` (a service, `StateTransfer { dehydrate(); hydrate(state) }`). A layer that provides it has its state written into the hydration payload (`transfer`, one value per script) and handed to `hydrate` before the app's first run. A stream calls `dehydrate` once per flush, so the transfer returns only what changed. A state its `hydrate` throws on is reported as `HydratePayloadInvalid`.
- **Renderer hooks.** `@sleekstack/ui/internal` exports `Collector` and `RenderScope` for integration packages. Not for applications.
- **Bindings move.** `useQuery`, `useSuspenseQuery`, `useMutation`, `useQueryClient`, `QueryFailed` and the types now live in `@sleekstack/query/ui`, with `QueryTransferLive` (a `Transfer` over the scope's client) and `UiQueryClientLive` (`QueryClientLive` plus it). `@sleekstack/ui` and `@sleekstack/core` are optional peers of `@sleekstack/query`; its main entry stays framework-neutral.
- `@sleekstack/ui` has no dependency or peer dependency on `@sleekstack/query` or `@tanstack/query-core`.

## Consequences

- An app that renders on the server provides `UiQueryClientLive()`; with plain `QueryClientLive()` the cache does not travel (queries refetch on the client).
- The hydration payload key `queries` is now `transfer` (same TanStack `DehydratedState` inside).
- Other data libraries can integrate the same way, without a change to ui.
- Tests of the query bindings run in `@sleekstack/query`; ui tests of the payload use a stand-in `Transfer`.
