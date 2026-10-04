## Goal & Context
<!-- scope: business -->

Components are `Effect`s and can already be async, but the renderer has no notion of "not ready yet": `mount` and `renderToString` run the whole tree to a finished `Node` before planning or serializing (`component.ts`, `string.ts`), so one slow child blocks everything. Production apps need a loading boundary. This spec adds `<Pending fallback={…}>` plus a query primitive that can actually wait. Second in the roadmap after fn-23 (reconciler).

## Architecture & Data Models
<!-- scope: technical -->

Facts verified against the code: `useQuery` never suspends (it returns `getOptimisticResult` with status `pending`), and under `renderToString` there is no `RenderScope`, so a query renders its loading state on the server. A fork inside a component has nowhere to land in a finished `Node`.

- **Representation (decided): `Pending` is a component instance with an internal slot atom**, built the way `useLocal` slots are (`reactive.ts`). Its content runs as a fiber forked into the instance's `RenderScope`; the slot holds `undefined` until the content finishes, then is set with the resolved `Node`, and the normal re-run and reconcile path swaps it in. While `undefined`, the instance renders `fallback`. Task 1 may refine the mechanics but keeps this shape, and must expose the instance's `{ fallback, content }` to the string renderer so fn-27 can stream it.
- **Keep previous content (decided default; no `mode` prop).** A re-run of the boundary's content keeps the previously resolved subtree on screen until the replacement is ready. That subtree's run scope, subscriptions and query observers stay open until the replacement commits, then close (fn-23 closes a run scope when the next run is applied; here "applied" is the commit of the replacement, not the start of its run). Only the first run shows `fallback`.
- **Waiting query primitive.** Add `useSuspenseQuery` (name checked against ADR 0019 and `exportNames.test.ts`) in `@sleekstack/ui` query: it waits through `client.ensureQueryData`/`fetchQuery` run as an Effect, fails with the query's typed error, retains the observer like `useQuery` does, and works under `renderToString` (awaits, no loading state in the HTML). `useQuery` is unchanged.
- **renderToString** awaits `Pending` content and emits no fallback; streaming is fn-27.
- **Analyzer:** `ui/jsx-runtime#Pending` is transparent like `Provider`/`Boundary` (`packages/analyze/src/components.ts` special-cases only those): its children's `R` and `E` pass through unchanged. No new `AnalyzeCode` (closes the earlier open question). Routing of event-closure errors to boundaries on a committed tree, deferred by fn-23, is deferred again to a later spec.

## API Contracts
<!-- scope: technical -->

`Pending(props: { fallback: Child; children?: Child }): Element`, exported from `@sleekstack/ui` and re-exported by the JSX runtime; `useSuspenseQuery(options)`.

## Edge Cases & Constraints
<!-- scope: technical -->

Nested `Pending` (innermost wins); `Pending` in a keyed list (key reaches the instance); unmount or supersede while pending (fiber interrupted, scopes closed); content failure goes to the error path unchanged (nearest `Boundary`, else `onError`); the fallback itself must not suspend; a second run starting while the first is pending is latest-wins.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A child that takes time renders `fallback` first, then its result in the same DOM position, in jsdom tests with a controllable promise. Errors: a content failure renders the nearest `Boundary` fallback, or reports to `onError` and leaves `fallback` showing.
- **R2:** A re-run of resolved content keeps the previous subtree on screen and never shows `fallback`; the old subtree's query observer retain count stays above zero until the new content commits, then releases. Errors: if the new run fails the old content stays and the error is reported.
- **R3:** Unmounting or superseding while pending interrupts the fiber and closes scopes; no listener, subscription or observer leaks (retain count back to zero). Errors: none beyond the interruption.
- **R4:** `useSuspenseQuery` resolves under `Pending` on the client and under `renderToString`, and a failed query surfaces its typed error through the boundary. Errors: an unprovided query client fails with the existing tagged error.
- **R5:** `renderToString` awaits content and emits no fallback markup, with `useQuery`-based components unchanged. Errors: a failing child surfaces its typed error as before.
- **R6:** The Analyzer treats `Pending` as transparent: a test shows a child's `R` and `E` reach `sleekstack check` through it. Errors: none.
- **R7:** `apps/ui-demo` shows `Pending` around a `useSuspenseQuery` list, its test passes and the demo stays analyzer-clean; ADR 0015 gets an amendment and README/CONTEXT define Pending.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=ui-demo`

## Boundaries
<!-- scope: business -->

Not streaming, not hydration, not `use()`-style throwing of promises.

## Decision Context
<!-- scope: both -->

Depends on fn-23. Slot-atom representation chosen over a new `Node` kind so the existing reconcile path does the swap. Defines the shape fn-27 streams.
