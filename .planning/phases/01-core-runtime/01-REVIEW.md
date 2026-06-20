---
phase: "01"
status: clean
fixed_at: "2026-06-20"
critical_count: 4
warning_count: 4
info_count: 3
---

# Phase 01 Code Review

**Reviewed:** 2026-06-20
**Depth:** deep (cross-file, import graph, call chains)
**Files Reviewed:** 7

## Summary

The core `module()` + cycle detection implementation is correct and well-structured. The React integration layer (`LayerProvider` + `useService`) has four blockers: a silent async-dispose failure, a broken `types` field in `package.json`, an infinite-Suspense loop when a service resolves to `undefined`, and an undocumented crash when a parent layer uses async acquisition in a nested provider. Four warnings cover silent stale state, an error-path gap, a type definition divergence, and a stale closure risk.

---

## Findings

### Critical

---

#### CR-01: `disposeRuntime` silently swallows failures for async Layer finalizers

**File:** `packages/react/src/LayerProvider.tsx:115-125`

**Issue:** `disposeRuntime` calls `runtime.runSyncExit(runtime.disposeEffect)`. The `runSyncExit` implementation (confirmed in `effect/dist/cjs/internal/runtime.js:198`) does NOT throw when the effect crosses an async boundary — it returns `Exit.die(AsyncFiberException)` instead. The `try/catch` block therefore never fires. When `Scope.close` contains any async finalizer steps, the dispose silently returns without actually closing the scope, leaking the runtime's resources. The fallback `dispose?.()` (async) is also never awaited, so even the fallback path produces an unhandled promise.

**Impact:** Layer.scoped with async acquire or async finalizers (e.g. any finalizer that itself calls `Effect.promise`) will not clean up on unmount. Resources leak silently.

**Fix:**
```ts
function disposeRuntime(runtime: ManagedRuntime.ManagedRuntime<any, never>): void {
  // runSyncExit returns Exit, never throws. Inspect the Exit to detect async die.
  const exit = runtime.runSyncExit(runtime.disposeEffect as any)
  if (exit._tag === 'Failure') {
    // Async boundary or defect — fall back to async dispose (fire-and-forget in cleanup).
    // Best-effort: cannot await in a React cleanup function.
    void runtime.dispose()
  }
}
```

Alternatively, always call the async path:
```ts
function disposeRuntime(runtime: ManagedRuntime.ManagedRuntime<any, never>): void {
  // dispose() is async; in a React cleanup we cannot await, but it is the safest path.
  void runtime.dispose()
}
```

---

#### CR-02: `packages/react/package.json` `types` field points to a nonexistent file

**File:** `packages/react/package.json:6`

**Issue:** `"types": "src/index.ts"` — the file does not exist. The actual barrel is `src/index.tsx`. TypeScript consumers that resolve types via the `types` field (e.g. other workspace packages, or downstream library consumers) will get a module-not-found error and fall back to no type information.

**Impact:** `@sleekstack/react` exports no TypeScript types to external consumers. Any downstream package importing `{ LayerProvider, useService }` from `@sleekstack/react` receives implicit `any` for all symbols.

**Fix:**
```json
"types": "src/index.tsx"
```

---

#### CR-03: `useService` loops infinitely when a service resolves to `undefined`

**File:** `packages/react/src/useService.ts:75`

**Issue:** The sync fast-path check is `cached.value !== undefined`. If `ManagedRuntime.runPromise(tag)` resolves with the value `undefined` (which is valid JavaScript and a legal service implementation), the `.then` handler stores `{ value: undefined }`. On the next render `cached.value !== undefined` is `false`, so the hook falls through to the cache-miss branch, starts a new acquisition, and throws a new Promise — suspending the component again indefinitely.

Additionally, `cached.error !== undefined` on line 81 has the same structural issue: if an Effect throws `undefined` (legal in JS/TS), the stored `{ error: undefined }` is never caught by the error check, and the hook loops to the cache-miss branch and re-suspends forever instead of propagating to the ErrorBoundary.

**Impact:** Any service whose value is `undefined` causes infinite Suspense. Any Layer that defects with `undefined` loops forever instead of hitting the ErrorBoundary.

**Fix:** Use a discriminated state field instead of `undefined`-based discrimination:
```ts
// In context.ts, replace CacheEntry:
export type CacheEntry =
  | { status: 'pending'; promise: Promise<void> }
  | { status: 'resolved'; value: unknown }
  | { status: 'rejected'; error: unknown }

// In useService.ts:
if (cached !== undefined) {
  if (cached.status === 'resolved') return cached.value as T
  if (cached.status === 'rejected') throw cached.error
  if (cached.status === 'pending')  throw cached.promise
}
// cache miss...
```

---

#### CR-04: Nested `LayerProvider` crashes when parent has an async Layer

**File:** `packages/react/src/LayerProvider.tsx:182`

**Issue:** `parentState.runtime.runSync(Effect.context<never>())` is called during render in the null-guard. `runSync` throws `AsyncFiberException` when the parent's `runtimeEffect` has not yet resolved synchronously — which happens whenever the parent's composed layer includes any async Effect step (e.g. `Layer.effect(Effect.promise(...))`, `Layer.fromEffect(Effect.tryPromise(...))`).

The JSDoc at line 148 warns "Layers with async effects cannot be used in nested providers" but this restriction is **undocumented in the public API surface** (`types.d.ts`, JSDoc on `LayerProvider` from the barrel). Users placing nested `LayerProvider` with an async parent layer receive an uncaught exception during render rather than a clear error.

The crash also occurs before `useEffect` runs, meaning `stateRef.current` may have been partially written in a prior render pass and left in an inconsistent state under React Strict Mode's double-invoke.

**Impact:** Nested providers silently crash in any realistic use case that involves async service initialization in the parent scope.

**Fix:** Replace the synchronous `runSync` call with an async-aware path. If the parent runtime has not yet built (i.e. `cachedRuntime === undefined`), defer child initialization:
```ts
// In LayerProvider, guard the nested initialization:
if (parentState !== null) {
  if ((parentState.runtime as any).cachedRuntime === undefined) {
    // Parent runtime not yet built. Child LayerProvider cannot initialize yet.
    // Throw a Promise that resolves when the parent runtime is ready,
    // triggering Suspense on the LayerProvider itself rather than crashing.
    throw parentState.runtime.runtime() // returns Promise<Runtime>
  }
  const parentCtx = parentState.runtime.runSync(Effect.context<never>())
  parentContextLayer = Layer.succeedContext(parentCtx) as unknown as Layer.Layer<any, any, any>
}
```
Alternatively: add explicit public API documentation to `LayerProviderProps` in `types.d.ts` that nested providers require synchronous parent layers, and add a runtime guard that throws a descriptive `Error` rather than letting `runSync` throw `AsyncFiberException`.

---

### Warning

---

#### WR-01: `provide` prop changes silently ignored after mount

**File:** `packages/react/src/LayerProvider.tsx:173`

**Issue:** The `if (stateRef.current === null)` guard ensures the runtime is created exactly once per mount. This is correct for stability, but it means that if the `provide` prop changes between renders (e.g. a user passes a dynamically constructed array), the new layers are silently ignored — the original runtime from the first mount continues to serve all `useService` calls. No warning is emitted, no error is thrown.

**Impact:** Silent stale service composition. A developer passing `provide={computedLayers}` where `computedLayers` changes will see no update and no error message, making the bug very hard to diagnose.

**Fix:** Add a development-mode warning:
```ts
// After the null-guard block, in development only:
if (process.env.NODE_ENV !== 'production' && stateRef.current !== null) {
  // provide changed after mount — this is a no-op; log a warning
  // (comparing by reference is sufficient to detect the common mistake)
  if (provide !== stateRef.current.__originalProvide) {
    console.warn(
      '[LayerProvider] The `provide` prop changed after mount. ' +
      'LayerProvider does not re-initialize on prop changes. ' +
      'To use new layers, unmount and remount the LayerProvider.'
    )
  }
}
```
Also add a note to the JSDoc on `LayerProvider` and `LayerProviderProps` that `provide` is only read on the first mount.

---

#### WR-02: `parentState` captured in `useEffect` closure is potentially stale

**File:** `packages/react/src/LayerProvider.tsx:209-244`

**Issue:** `parentState` is read from `useContext` on every render (line 168), but the `useEffect` has empty deps (`[]`), so the closure captures the `parentState` value from the first render only. If the parent `LayerProvider` is replaced (remounts), the inner provider's `useEffect` cleanup calls `unregister?.()` on the old (now disposed) `parentState.registerChildDispose` function. Since `childDisposals` in the old parent's state is already `null`-ed via `stateRef.current = null` (line 241), the unregister call invokes `splice` on a now-orphaned array, which is harmless but incorrect (the unregister silently no-ops when it should have operated on the new parent's disposal list).

In Strict Mode double-invoke, the effect runs twice: the first cleanup fires with the correct parent, but the second mount's effect captures a potentially-stale `parentState` reference because `useContext` result does not update the stale closure.

**Fix:** Add `parentState` to the `useEffect` dependency array and explicitly handle cleanup/re-registration:
```ts
useEffect(() => {
  // ... registration logic ...
  return () => { unregister?.(); /* ... dispose logic ... */ }
}, [parentState]) // re-register when parent changes
```
This requires the cleanup/registration logic to be idempotent (which it currently is via `unregister`).

---

#### WR-03: `LayerProviderProps` interface defined in two places with no cross-reference

**File:** `packages/react/src/LayerProvider.tsx:129` and `packages/react/src/types.d.ts:30`

**Issue:** `LayerProviderProps` is defined as an `export interface` in `LayerProvider.tsx` (line 129) and as a separate `export interface` in `types.d.ts` (line 30). They currently have identical shapes, but they are structurally independent — TypeScript does not verify they remain in sync. A future change to `LayerProvider.tsx`'s props (e.g. adding an `onError` callback) will not automatically update `types.d.ts`, silently breaking the public type contract exported from the barrel.

Additionally, `index.tsx` exports `LayerProviderProps from './types'` (not from `'./LayerProvider'`), meaning the public export comes from the `.d.ts` declaration file, which diverges from the actual runtime interface in `LayerProvider.tsx`.

**Fix:** Remove the duplicate from `types.d.ts` and re-export from `LayerProvider.tsx`:
```ts
// types.d.ts — remove the LayerProviderProps interface declaration
// index.tsx — change to:
export type { LayerProviderProps } from './LayerProvider'
```

---

#### WR-04: `disposeRuntime` called on `stateRef.current` inside child-disposal callback, but outer cleanup also calls it if `stateRef.current` is non-null

**File:** `packages/react/src/LayerProvider.tsx:219-242`

**Issue:** The inner `LayerProvider`'s `registerChildDispose` callback (line 219-222) sets `stateRef.current = null` after calling `disposeRuntime`. The inner provider's own `useEffect` cleanup (line 232) then checks `if (stateRef.current !== null)` before calling `disposeRuntime` again — which correctly prevents double-disposal.

However, the `unregister?.()` on line 231 removes the child from the parent's `_childDisposals` list. If `unregister` runs first (which it does), the parent will never call the child's dispose callback. But then the child's own cleanup at line 232 checks `stateRef.current !== null` and finds it non-null (it was not disposed by the parent since it was unregistered first). The child correctly disposes itself.

The ordering is: (1) `unregister()` removes child from parent's list → (2) child's own cleanup disposes child runtime. This is logically correct for the normal unmount case. However, for the concurrent-dispose path (parent's cleanup calls child's dispose first before child's own cleanup runs), the outer cleanup at line 235-238 iterates `_childDisposals` and calls each fn, which sets `stateRef.current = null`, then the child's own cleanup fires and sees `stateRef.current === null` — correct, no double-dispose.

The subtle issue: `unregister?.()` is called before checking if the parent already disposed the child. If the parent already ran the child's dispose (setting `stateRef.current = null`) before the child's own cleanup fires (e.g. in the `_childDisposals` iteration), and then the child's own cleanup calls `unregister?.()` — the `splice` call operates on the already-modified `childDisposals` array to remove an entry that no longer exists (`lastIndexOf` returns -1, `splice` is skipped). This is harmless, but the comment says "Unregister from parent FIRST (prevent double-disposal)" which is misleading — by the time the cleanup runs after parent-initiated disposal, the entry was already removed during `disposeRuntime`.

This is not a bug in the happy path but creates confusion when tracing the disposal sequence and could become a bug if the LIFO iteration logic is modified.

**Fix:** Add a comment clarifying that `unregister?.()` is a no-op when the parent already disposed the child (the `lastIndexOf` guard handles it), and consider tracking disposal state with an explicit `disposed` flag rather than relying on `stateRef.current === null` as the indicator.

---

### Info

---

#### IN-01: `JSX.Element` return type in `types.d.ts` is deprecated in React 19

**File:** `packages/react/src/types.d.ts:44`

**Issue:** `export declare function LayerProvider(props: LayerProviderProps): JSX.Element` — `JSX.Element` is deprecated in React 19 and will be removed. The global `JSX` namespace is no longer available unless `@types/react` is imported. The actual implementation in `LayerProvider.tsx` returns `React.ReactElement` implicitly.

**Fix:**
```ts
import type { ReactElement } from 'react'
export declare function LayerProvider(props: LayerProviderProps): ReactElement
```

---

#### IN-02: `(tag as any).identifier` in `useService` references a nonexistent property

**File:** `packages/react/src/useService.ts:61`

**Issue:** The tag name derivation chain is `._tag ?? .key ?? .identifier ?? String(tag)`. In effect v3, `Context.Tag` instances have a `key` property (confirmed in `effect/dist/dts/Context.d.ts:43`). There is no `identifier` property on any Tag type in effect v3. The `identifier` fallback is dead code — `key` always resolves before it, and even if `key` were absent, `identifier` would be `undefined`. The final fallback `String(tag)` is the real safety net.

**Fix:** Remove the dead `identifier` fallback:
```ts
const tagName: string =
  (tag as any)._tag ??
  (tag as any).key ??
  String(tag)
```

---

#### IN-03: `_childDisposals` is a public field on `ProviderState` type

**File:** `packages/react/src/context.ts:50`

**Issue:** `_childDisposals: (() => void)[]` is exported as part of the `ProviderState` type. The leading underscore signals internal use, but the type is exported from `context.ts` and used in `LayerProvider.tsx`. Any code reading `ProviderContext` via `useContext(ProviderContext)` in a custom hook can freely mutate `_childDisposals`, bypassing the `registerChildDispose` contract.

**Fix:** Either close over `childDisposals` entirely within `LayerProvider` (not stored on the state at all), or mark the field as `readonly` and document it as internal-only. Removing it from the exported type and keeping it as a closure variable in `LayerProvider` is the cleanest approach.
