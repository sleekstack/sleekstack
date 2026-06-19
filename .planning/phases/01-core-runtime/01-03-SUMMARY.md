---
phase: 01-core-runtime
plan: "03"
subsystem: react-provider-runtime
tags: [LayerProvider, useService, ManagedRuntime, Suspense, ProviderContext, REACT-01, REACT-03, REACT-04, REACT-06, REACT-07, REACT-08, wave-3]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [react-provider-context, layer-provider-component, use-service-hook, react-barrel-api]
  affects: [packages/react]
tech_stack:
  added: []
  patterns: [ManagedRuntime-lifecycle, useRef-null-guard, three-state-suspense-cache, effect-error-before-promise]
key_files:
  created:
    - packages/react/src/context.ts
    - packages/react/src/LayerProvider.tsx
    - packages/react/src/useService.ts
  modified:
    - packages/react/src/types.d.ts
    - packages/react/src/index.tsx
decisions:
  - "Layer.empty cast to Layer<any,any,any> via unknown intermediate: ManagedRuntime.make requires R=never but assembleLayer returns any — TypeScript formality, cast is safe at runtime"
  - "ManagedRuntime.make result cast via any to satisfy ProviderState.runtime type (ManagedRuntime<any,never>) — the composed layer is self-contained so never is semantically correct"
  - "Module detection in assembleLayer uses duck-typing (_name + _layers + _imports fields) rather than instanceof — keeps react package decoupled from core module internals at runtime"
metrics:
  duration: "4 minutes"
  completed_date: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
status: complete
---

# Phase 01 Plan 03: React Provider Runtime Summary

Implemented SleekStack's core ONE thing: `useService(Tag)` resolves a service from the nearest `LayerProvider` via ManagedRuntime, suspends on first acquisition, returns synchronously from cache thereafter, with deterministic cleanup on unmount. Prototype `index.tsx` fully replaced; Runtime/Scope/Fiber hidden from public exports.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ProviderContext and ProviderState (runtime + cache) | 4bf4849 | packages/react/src/context.ts (created) |
| 2 | Implement LayerProvider (single-scope ManagedRuntime lifecycle) | a8e80ee | packages/react/src/LayerProvider.tsx (created) |
| 3 | Implement useService hook, rewrite react types.d.ts and index.tsx barrel | c23821b | useService.ts (created), types.d.ts (rewritten), index.tsx (rewritten), LayerProvider.tsx (type fixes) |

## What Was Built

### Task 1: context.ts — ProviderContext + ProviderState + CacheEntry

Created `packages/react/src/context.ts` (extracted from inline prototype).

- `CacheEntry` type: `{ value?: unknown; promise?: Promise<any>; error?: any }`
- `ProviderState` type: `{ runtime: ManagedRuntime.ManagedRuntime<any, never>; cache: Map<any, CacheEntry> }` — runtime and cache co-located so both reset atomically per mount/unmount (Strict Mode safety)
- `ProviderContext` created via `createContext<ProviderState | null>(null)` — null default means no ancestor provider

### Task 2: LayerProvider.tsx — single-scope ManagedRuntime lifecycle

Created `packages/react/src/LayerProvider.tsx` implementing the component per RESEARCH.md Pattern 1.

**`assembleLayer(provide)` helper:**
- Plain Effect Layers pass through unchanged
- Module values are detected via duck-typing (`_name + _layers + _imports`) and flattened via `flattenModuleToLayer()` which recursively collects `_layers` + `_imports._layers`
- Multiple layers combined with `Layer.mergeAll` (last-in wins)

**`LayerProvider` component:**
- `stateRef = useRef<ProviderState | null>(null)` — stores runtime + cache per mount
- Null-guard in render body: `if (stateRef.current === null) { ... ManagedRuntime.make(composedLayer) ... }` — creates runtime exactly once per mount, survives concurrent re-renders
- `useEffect` cleanup: `stateRef.current?.runtime.dispose(); stateRef.current = null` — disposes runtime AND resets ref (the Strict Mode bug the prototype omitted)
- Wraps children in `ProviderContext.Provider`
- No `mergeLayers` prototype helper; no runtime/scope/fiber exposed

### Task 3: useService.ts + types.d.ts + index.tsx rewrite

**`useService.ts`:**
- Reads context via `useContext(ProviderContext)`; null check throws: `"Service '${tagName}' is not provided. Add a Layer for ${tagName} to a <LayerProvider> above this component."` (REACT-06 — names service AND instructs LayerProvider)
- Tag name derived from `(tag as any)._tag ?? key ?? identifier ?? String(tag)` — identifier only, no stack details (T-03-01)
- Three-state cache in exact order: value (sync fast-path) → error (before promise, Pitfall 3) → promise (in-flight Suspense) → cache miss starts `runtime.runPromise(tag)` with `.then({value}) / .catch({error})` transition
- JSDoc documents Suspense boundary requirement with usage example (D-02)

**`types.d.ts` rewrite:**
- Removed: `ServiceOverrides`, `ServiceProviderProps`, `ServiceProvider`, `TryGetResult`, `tryGetService`, `provideService` (D-03, D-04)
- Added: `LayerProviderProps` with readonly `provide` array and optional `children`; `LayerProvider` declaration; `useService<T>` declaration

**`index.tsx` rewrite (thin barrel):**
- `export { LayerProvider } from './LayerProvider'`
- `export { useService } from './useService'`
- `export type { LayerProviderProps } from './types'`
- No Runtime, Scope, Fiber, or prototype symbols (REACT-07)

## Verification Results

```
REACT-01 — LayerProvider.test.tsx (2 tests): PASS (provide prop + Module flattening)
REACT-03 — useService.test.tsx (1 test): PASS (sync fast-path after first resolution)
REACT-04 — LayerProvider.test.tsx (2 tests): PASS (Suspense on first call, resolved after)
REACT-06 — useService.test.tsx (2 tests): PASS (message contains LayerProvider + service name)
REACT-07 — useService.test.tsx (5 tests): PASS (no Runtime/Scope/Fiber/EffectLib/createService)
REACT-08 — LayerProvider.test.tsx (1 test): PASS (Layer.scoped cleanup spy called on unmount)
Total: 13 tests passed (LayerProvider.test.tsx + useService.test.tsx)
typecheck (tsc --noEmit): PASS
grep prototype helpers: only in comments, no active code
```

REACT-02 (nesting.test.tsx — nested provider inheritance) remains RED as expected — it is Plan 01-04's responsibility. The plan explicitly defers nested-provider scope to Plan 01-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type cast for Layer.empty return type**
- **Found during:** Task 3 (typecheck run)
- **Issue:** `Layer.empty` returns `Layer<never, never, never>` which is not assignable to `Layer<any, any, any>` — TypeScript strict variance mismatch
- **Fix:** Added `as unknown as Layer.Layer<any, any, any>` cast on two `Layer.empty` usages in `assembleLayer` and `flattenModuleToLayer`
- **Files modified:** `packages/react/src/LayerProvider.tsx`
- **Commit:** c23821b

**2. [Rule 1 - Bug] TypeScript type cast for ManagedRuntime.make return type**
- **Found during:** Task 3 (typecheck run)
- **Issue:** `ManagedRuntime.make(composedLayer)` returns `ManagedRuntime<any, any>` but `ProviderState.runtime` is typed `ManagedRuntime<any, never>` — TypeScript infers error type as `any` instead of `never`
- **Fix:** Added intermediate `as any` cast on the `runtime` assignment. Semantically correct: the composed layer is self-contained so `never` (no errors) is the intended constraint
- **Files modified:** `packages/react/src/LayerProvider.tsx`
- **Commit:** c23821b

## Known Stubs

None — all exported functions are fully implemented with real Effect runtime wiring. `LayerProvider` creates an actual `ManagedRuntime` and `useService` resolves via `runtime.runPromise(tag)`.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All changes are pure library code.

Threat mitigations from the plan's threat register — all implemented:
- **T-03-01** (Information Disclosure): `useService` error messages contain service identifier + remediation instruction only; no internal Effect call stacks
- **T-03-02** (DoS/Reliability): `dispose()` is idempotent; ref reset to null in cleanup prevents stale cache on Strict Mode remount
- **T-03-03** (Tampering): `index.tsx` barrel exports only `LayerProvider` + `useService` + `LayerProviderProps`; no Runtime/Scope/Fiber leakage — verified by negative grep

## Self-Check: PASSED

All 5 created/modified files found on disk. All 3 task commits verified in git log (4bf4849, a8e80ee, c23821b).
