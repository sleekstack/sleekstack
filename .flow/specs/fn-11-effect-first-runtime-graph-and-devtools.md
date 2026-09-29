# Effect-first runtime, graph and devtools; sugar moves to kit

## Goal & Context
<!-- scope: business -->

`@sleekstack/next` ships `configureRuntime` plus `action()` / `query()`: sugar over Effect that only kit consumes. Direction: SleekStack does not encapsulate Effect. For Effect users in Next and React apps we provide runtime management, the dependency graph and devtools; sugar (`action`, `query`, `defineEffect`, result envelopes) lives in `@sleekstack/kit` only.

The plain-Effect showcase (apps/showcase, rewritten 2026-09-29) already runs on `ManagedRuntime` + `Layer.scoped` with a hand-written `runApp` (request scope via `Effect.provide`, demo shadowing via `Effect.provide`, defect reporting). That code is the API this spec productizes.

Depends on fn-9 (static graph, ResolutionPlan). Task 1 and the analyzer task start only after fn-9.7 lands; docs task after fn-9.8.

## Architecture & Data Models
<!-- scope: technical -->

- **`@sleekstack/next`**: remove `action`, `query`, `Operation`, `OperationOptions`. `configureRuntime({ layer, onError })` builds one `ManagedRuntime` over `layer`, cached on a versioned `globalThis` key (HMR-safe; reconfigure interrupts in-flight fibers, then disposes). Existing `provide` (modules/entries) config stays supported for kit and maps onto the same `runEffect` entry point. New: `runEffect(effect, { request?, overrides? })` and `getRuntime()`. `request` is a Layer built per call and released when the call ends; `overrides` is a Layer provided outside `request` so it shadows for both the effect and request services.
- **Runtime contract**: typed failures and defects reject the same way `Effect.runPromise` does (no thrown-message redaction here; kit's envelopes own that). `onError(cause)` receives defects and finalizer failures, is called after wrapper classification (kit's classification-before-unwrap ordering is preserved), and if it throws it is swallowed and never replaces the original outcome. Next control-flow throws (redirect, notFound) and interruptions pass through untouched and are not reported. ADR 0009's internal exit hook keeps working. A layer build failure is not cached: the runtime slot resets so the next call retries. `runEffect` before `configureRuntime` fails with `RuntimeNotConfigured`.
- **Analyzer**: reads plain Effect layers from `configureRuntime({ layer })` roots. Type-based: leaf `Layer.effect/scoped/succeed/sync` give provides (ROut Tags) and requires (RIn Tags) from the checker; `Layer.mergeAll/provide/provideMerge` are walked structurally. A layer the analyzer cannot resolve precisely (opaque, `any`) is a build error (fail closed, as fn-9.9 does), never an empty graph. Tag identity follows the existing `Context.Tag` / `GenericTag` handling. Same Report schema as today; `runtime.graph()` returns that Report shape.
- **Devtools**: new package `@sleekstack/devtools` (React panel + data model), dev-only. Data comes from a bounded (200 events) per-process buffer in `@sleekstack/next` recording scope open/close, acquire/release and errors, cleared on reconfigure, exposed by a dev-only route handler; the panel polls it. Panel shows graph (from the analyzer Report), live scopes, atom store contents (read-only) and last errors. Production builds contain no panel or buffer (bundle test).
- **`@sleekstack/kit`**: `action` / `query` / `defineEffect` / `defineQuery` / `effect` re-implemented on `runEffect`, building per-call `overrides` from the caller's modules without flattening them. Public API and tests unchanged.
- **Decision Context**: rejected a separate `runtime.graph()` schema (one Report shape, two sources would drift); rejected shipping devtools inside react (would land in client bundles; own package with a dev-only entry keeps that checkable).

## API Contracts
<!-- scope: technical -->

- Removed from `@sleekstack/next`: `action`, `query`, `Operation`, `OperationOptions` (breaking, pre-1.0, migration prose in docs).
- Added: `configureRuntime({ layer, onError })`, `runEffect`, `getRuntime`, dev-only devtools handler.
- `@sleekstack/devtools`: `<SleekStackDevtools />` panel; no production export condition.
- TSDoc `@throws` names the adapter functions, not core error names.

## Edge Cases & Constraints
<!-- scope: technical -->

- Two module copies (RSC vs action bundle) share the versioned `globalThis` slot, so one runtime exists.
- An override that shadows an app-scoped service applies to the call only; dependents inside the call see it, app-level singletons already built do not (documented, matches the showcase).
- Devtools must not import server-only code; the handler is a separate entry.
- Docs Next snippets keep their `'use server'` wrappers around kit `action()`.
- Not in scope: SSR/hydration of atoms, React Router and TanStack Start adapters (they reuse `runEffect` later), a codemod (migration is prose), new sugar in next or react.

## Acceptance Criteria
<!-- scope: business -->

- **R1:** `@sleekstack/next` exports no `action`/`query`/`Operation`/`OperationOptions`; kit's Next entry points pass their existing tests (including the ADR 0009 exit-hook test) on `runEffect`. Errors: calling `runEffect` before `configureRuntime` rejects with `RuntimeNotConfigured`; a kit call whose modules contain a request service shadowed per call still shadows (no flattening).
- **R2:** `apps/showcase` uses `@sleekstack/next` for runtime management and has no hand-written runtime module. Errors: a defect still rejects and is recorded in the activity log; the requests test suite passes.
- **R3:** The analyzer resolves the showcase's plain Layers into provides/requires edges, and `/graph` (and `/errors`) pages render from its Report. Errors: an unresolvable or `any`-typed layer fails the check with file:line, never an empty graph.
- **R4:** Devtools panel shows graph, live scopes, atoms and errors in dev and is absent from production client chunks. Errors: with the handler disabled or the buffer empty the panel renders an empty state; buffer never exceeds its bound.
- **R5:** ADR 0010 (supersedes the action/query part of the next adapter decisions), CONTEXT.md, READMEs, apps/docs mdx and snippets, and a migration note are updated. No error surface beyond stale references.
- **R6:** Runtime contract holds: `onError` receives defects and finalizer failures once each, a throwing `onError` never changes the result, redirect/notFound/interruption pass through unreported, and a failed layer build is retried on the next call. Errors: reconfigure during in-flight calls interrupts them before disposing.

## Early proof point
Task fn-11-effect-first-runtime-graph-and-devtools.1 validates that a Layer-based `runEffect` can carry request scope and overrides with the contract above. If it fails, re-evaluate keeping core AppScope as the runtime before continuing with tasks 2+.

## Quick commands
```bash
pnpm --filter @sleekstack/next test && pnpm --filter @sleekstack/kit test
pnpm --filter showcase typecheck && pnpm --filter showcase test
```

## Boundaries
<!-- scope: business -->

Not doing: new sugar in next or react; atom SSR; other framework adapters; a codemod.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `@sleekstack/next` exports no `action`/`query`/`Operation`/`OperationOptions`; kit's Next entry points pass their existing tests (including the ADR 0009 exit-hook test) on `runEffect`. Errors: calling `runEffect` before `configureRuntime` rejects with `RuntimeNotConfigured`; a kit call whose modules contain a request service shadowed per call still shadows (no flattening). | fn-11-effect-first-runtime-graph-and-devtools.1, fn-11-effect-first-runtime-graph-and-devtools.2 | — |
| R2 | `apps/showcase` uses `@sleekstack/next` for runtime management and has no hand-written runtime module. Errors: a defect still rejects and is recorded in the activity log; the requests test suite passes. | fn-11-effect-first-runtime-graph-and-devtools.5 | — |
| R3 | The analyzer resolves the showcase's plain Layers into provides/requires edges, and `/graph` (and `/errors`) pages render from its Report. Errors: an unresolvable or `any`-typed layer fails the check with file:line, never an empty graph. | fn-11-effect-first-runtime-graph-and-devtools.3, fn-11-effect-first-runtime-graph-and-devtools.5 | — |
| R4 | Devtools panel shows graph, live scopes, atoms and errors in dev and is absent from production client chunks. Errors: with the handler disabled or the buffer empty the panel renders an empty state; buffer never exceeds its bound. | fn-11-effect-first-runtime-graph-and-devtools.4, fn-11-effect-first-runtime-graph-and-devtools.6 | — |
| R5 | ADR 0010 (supersedes the action/query part of the next adapter decisions), CONTEXT.md, READMEs, apps/docs mdx and snippets, and a migration note are updated. No error surface beyond stale references. | fn-11-effect-first-runtime-graph-and-devtools.7 | — |
| R6 | Runtime contract holds: `onError` receives defects and finalizer failures once each, a throwing `onError` never changes the result, redirect/notFound/interruption pass through unreported, and a failed layer build is retried on the next call. Errors: reconfigure during in-flight calls interrupts them before disposing. | fn-11-effect-first-runtime-graph-and-devtools.1 | — |

