---
phase: 01-core-runtime
plan: "04"
subsystem: react-nested-provider-playground
tags: [LayerProvider, nested-scope, shadowing, REACT-02, REACT-05, CORE-03, playground, D-08, D-09, wave-4]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [nested-provider-inheritance, shadowing-via-provide-ordering, playground-happy-path]
  affects: [packages/react, apps/playground]
tech_stack:
  added: []
  patterns: [registerChildDispose-inner-before-outer, Layer.mergeAll-parent-first-child-last, module-imports-auto-pull, ErrorBoundary-Suspense-composition]
key_files:
  created: []
  modified:
    - packages/react/src/context.ts
    - packages/react/src/LayerProvider.tsx
    - apps/playground/src/api-example.tsx
decisions:
  - "React 19 runs useEffect cleanups parent-before-child; inner-before-outer finalization achieved by having inner LayerProvider register its dispose with parent (registerChildDispose); parent calls registered child disposals LIFO before its own dispose"
  - "parentContextLayer cast via 'as unknown as Layer<any,any,any>' — Layer.succeedContext returns Layer<never,never,never>; TypeScript formality, cast is semantically safe"
  - "Playground uses AppModule that imports HttpModule — only AppModule in LayerProvider.provide, HttpModule layers auto-pulled (CORE-03); nested LayerProvider with MockHttpClientLayer shadows real HttpClient (REACT-05)"
metrics:
  duration: "7 minutes"
  completed_date: "2026-06-20"
  tasks_completed: 2
  tasks_total: 3
  files_created: 0
  files_modified: 3
status: complete
---

# Phase 01 Plan 04: Nested Provider + Playground Summary

Extended `LayerProvider` for nested scope inheritance and shadowing (REACT-02, REACT-05, CORE-03), and rewrote the playground to demonstrate the full Phase 1 happy path (D-08, D-09). Discovered and fixed a React 19 behavioral difference: `useEffect` cleanups run parent-before-child in React 19, requiring a `registerChildDispose` mechanism to ensure inner-before-outer finalization.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend LayerProvider for nested scope inheritance + shadowing | 43e8a58 | context.ts (modified), LayerProvider.tsx (modified) |
| 2 | Rewrite the playground to demonstrate the full happy path (D-08, D-09) | c175279 | api-example.tsx (created) |
| 3 | Human-verify the playground in a browser | — | CHECKPOINT — awaiting human verification |

## What Was Built

### Task 1: LayerProvider — nested scope inheritance + shadowing

**`packages/react/src/context.ts` — ProviderState with registerChildDispose:**

Added `registerChildDispose(fn) → unregister` and `_childDisposals: (() => void)[]` to `ProviderState`. The `registerChildDispose` mechanism allows inner `LayerProvider` mounts to register their dispose function with the parent. The parent calls all registered disposals in LIFO order before its own dispose — ensuring inner scopes finalize before outer scopes (REACT-02).

**`packages/react/src/LayerProvider.tsx` — nested scope wiring:**

- `assembleLayer`: unchanged from Plan 01-03; places parent context first, own layers last in `Layer.mergeAll` for shadowing (REACT-05, ADR 0003)
- `flattenModuleToLayer`: unchanged; recursively collects module._layers + imports._layers (CORE-03 auto-pull)
- `LayerProvider` render: reads `parentState` via `useContext(ProviderContext)`; if parent exists, calls `parentState.runtime.runSync(Effect.context<never>())` to extract parent's context; wraps it as `Layer.succeedContext(parentCtx)` placed first in `assembleLayer`
- `LayerProvider` cleanup (useEffect return): (a) unregisters from parent to prevent double-disposal; (b) calls `_childDisposals` LIFO; (c) disposes own runtime
- Inner provider registers its dispose with `parentState.registerChildDispose(...)` inside `useEffect`, returns unregister as the cleanup's first action

### Task 2: Playground — full happy-path demo

**`apps/playground/src/api-example.tsx` — rewrites from prototype:**

- Tags: `Context.GenericTag<T>(id)` imported directly from `effect` (ADR 0001)
- Layers: `Layer.scoped(Tag, Effect.acquireRelease(...))` for Logger, HttpClient, UserApi; finalizers log to console on unmount (REACT-08 demo)
- Modules: `HttpModule` (HttpClientLayer only), `AppModule` imports HttpModule + adds UserApiLayer (CORE-03 auto-pull demo)
- Root render: `<LayerProvider provide={[AppModule, LoggerLayer]}>` → `<ErrorBoundary>` → `<Suspense fallback="Initializing services...">` → service consumers (D-02, D-08)
- Section 3: nested `<LayerProvider provide={[MockHttpClientLayer]}>` shadows real HttpClient with mock — `HttpStatusCard` inside shows "[MOCK] Response…" instead of real response (REACT-05, D-09)
- `ErrorBoundary` class: copied verbatim from prototype (renders error.message only, no stack — T-04-03)
- `useService + useEffect cancelled-flag` pattern preserved from prototype

## Verification Results

```
packages/react:
  vitest run (full suite, 3 files): 19/19 tests passed
    - LayerProvider.test.tsx (6 tests): PASS — REACT-01, REACT-04, REACT-08
    - useService.test.tsx (7 tests): PASS — REACT-03, REACT-06, REACT-07
    - nesting.test.tsx (6 tests): PASS — REACT-02, REACT-05, CORE-03
  pnpm typecheck: PASS (no errors)

apps/playground:
  vite build: SUCCESS — 326 kB bundle, no unresolved imports or type errors

grep check: 'overrides' in LayerProvider.tsx — comment only, no prop
grep check: 'createService|createServiceProvider|ServiceProvider' in api-example.tsx — CLEAN
```

Human verification (Task 3): PENDING — awaiting developer browser check.

## REACT-02 Test Alignment

The nesting test `[REACT-02] inner LayerProvider unmount finalizer runs before outer when both unmount` passes because:
- Outer `LayerProvider` cleanup: calls `_childDisposals` LIFO (runs inner's dispose) → then disposes outer runtime
- Inner `LayerProvider` cleanup: first unregisters from parent (so parent doesn't double-dispose), then disposes nothing (already disposed by parent)
- Net result: InnerScopedLayer finalizer runs before OuterScopedLayer finalizer → `unmountOrder === ['inner', 'outer']`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React 19 runs useEffect cleanups parent-before-child, not child-before-parent**
- **Found during:** Task 1 (nesting.test.tsx REACT-02 ordering test failure)
- **Issue:** The plan comment (and 01-RESEARCH.md Assumption A1/A4) stated "React runs inner cleanups before outer cleanups" — verified false for React 19 with @testing-library/react. React 19 runs `useEffect` cleanups parent → child (top-down) during unmount for both `useEffect` and `useLayoutEffect`.
- **Fix:** Added `registerChildDispose` to `ProviderState`; inner providers register their dispose with the parent; parent calls LIFO child disposals before its own dispose
- **Files modified:** `context.ts` (added field + type), `LayerProvider.tsx` (useEffect registration + LIFO child disposal)
- **Commit:** 43e8a58

**2. [Rule 1 - Bug] TypeScript cast for Layer.succeedContext return type**
- **Found during:** Task 1 (typecheck run)
- **Issue:** `Layer.succeedContext(parentCtx)` returns `Layer<never, never, never>` which is not assignable to `Layer<any, any, any>` — the cast requires `as unknown as Layer<any,any,any>` (same pattern used in Plan 01-03 for Layer.empty)
- **Fix:** Added `as unknown as Layer.Layer<any, any, any>` cast
- **Files modified:** `packages/react/src/LayerProvider.tsx`
- **Commit:** 43e8a58

## Known Stubs

None — all exported functions are fully implemented. The playground uses real Effect layers with observable finalizers. The human-verify checkpoint is a behavioral check, not a code stub.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All changes are pure library code and a playground demo file.

Threat mitigations from the plan's threat register — implemented:
- **T-04-01** (Reliability): `registerChildDispose` returns an unregister function; child calls it before its own dispose to prevent double-disposal. Parent calls `disposeEffect` via `runSyncExit`; `stateRef.current` is reset to null after dispose.
- **T-04-02** (Tampering): Shadowing is purely positional in `Layer.mergeAll` (child layers last); consistent with ADR 0003's single mechanism.
- **T-04-03** (Information Disclosure): `ErrorBoundary.render()` shows `error.message` only — no stack trace.

## Self-Check: PASSED

All 3 modified files found on disk. Task 1 commit (43e8a58) and Task 2 commit (c175279) verified in git log. Full vitest suite (19/19) passes. vite build succeeds. Task 3 checkpoint is pending human verification.
