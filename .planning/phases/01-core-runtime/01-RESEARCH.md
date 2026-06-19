# Phase 01: Core Runtime - Research

**Researched:** 2026-06-20
**Domain:** Effect TS 3.x runtime management + React 19 Suspense integration
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** User owns the `<Suspense>` boundary — `LayerProvider` does NOT auto-wrap children.
- **D-02:** JSDoc on `LayerProvider` and `useService` must explicitly document the Suspense boundary requirement with a usage example.
- **D-03:** `tryGetService`, `provideService`, and `ServiceOverrides` are NOT shipped in Phase 1. Phase 1 exports only `LayerProvider` + `useService`.
- **D-04:** `packages/react/src/types.d.ts` is rewritten from scratch — remove all prototype-era types.
- **D-05:** `packages/core/src/types.d.ts` is also rewritten — remove `createService`, `createServiceProvider`, `ServiceProvider`, `ServiceFactory`, etc. Core exports only `module()` and the `Module` type (per ADR 0001).
- **D-06:** When a Layer's Effect fails during acquisition, `useService` throws the error on the next render — caught by the nearest React `<ErrorBoundary>`.
- **D-07:** `LayerProvider` has NO error recovery mechanism (no `onError` prop, no retry). Error propagation is the user's responsibility via React error boundaries.
- **D-08:** Phase 1 delivers a fully runnable playground (`apps/playground`) demonstrating the core happy path.
- **D-09:** The playground covers all 6 ROADMAP success criteria (module compilation, circular dep detection, Suspense resolution, shadowing, missing service error, cleanup on unmount).

### Claude's Discretion

- Internal Effect runtime management (how `ManagedRuntime`, `Scope`, and `Fiber` are wired inside `LayerProvider`) — follow Effect TS best practices
- TypeScript generics depth for `module()` exports narrowing — best-effort per ADR 0002
- Vitest test structure and file organization within packages
- Effect version-specific API choices (Effect 3.x)

### Deferred Ideas (OUT OF SCOPE)

- `tryGetService` — non-suspending variant; defer to Phase 2
- `provideService()` utility — defer to Phase 2
- `@sleekstack/testing` — deferred; shadowing covers 80% of testing needs
- Full DX error showcase in playground (missing service, circular dep demo) — Phase 1 playground covers happy path only

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | `module()` accepts `name` (required), `layers`, `imports?`, `exports?` and returns a typed Module | TypeScript generics pattern; `module()` function signature design in Standard Stack |
| CORE-02 | `module()` detects circular imports at definition time and throws with a full cycle trace | DFS cycle detection algorithm verified in Node.js; fires at call time synchronously |
| CORE-03 | Module `imports` are automatically pulled into any `LayerProvider` that includes the module | `Layer.provide(self, deps)` composition pattern — verified with Effect 3.21.x |
| CORE-04 | Module `exports` provide best-effort type-level isolation | Conditional type narrowing; unexported Tags excluded from generic surface (ADR 0002 caps complexity) |
| REACT-01 | `LayerProvider` accepts a `provide` prop of `Layer` values and `Module` values | ManagedRuntime.make(mergedLayer) + context from parent; prop type design in Architecture Patterns |
| REACT-02 | Nested `LayerProvider` inherits parent scope; inner scope finalizes before outer | `Layer.succeedContext(parentCtx)` + `Layer.mergeAll(parentCtxLayer, ...childLayers)` — verified |
| REACT-03 | `useService(Tag)` returns synchronously if already resolved | Cache Map pattern with `value` field check; sync fast-path before any Effect code |
| REACT-04 | `useService(Tag)` throws a Promise on first async call (Suspense) | Cache Map pattern with `promise` field; throw the in-flight Promise |
| REACT-05 | Replacement in `provide` array shadows transitive dependency from imports | `Layer.mergeAll` last-in-array wins; child layers placed AFTER parent context layer |
| REACT-06 | `useService(Tag)` with no ancestor provider throws descriptive error | Check `useContext(ProviderContext)` null; throw with message naming the missing Tag |
| REACT-07 | Runtime, Scope, Fiber never exposed; Tag, Layer, Effect are user-facing | ADR 0001 architectural boundary; `@sleekstack/core` exports ONLY `module()` |
| REACT-08 | Services acquired within a `LayerProvider` scope are finalized in reverse acquisition order on unmount | `ManagedRuntime.dispose()` reverses acquisition order — verified with Effect scoped layers |

</phase_requirements>

---

## Summary

Phase 1 builds two packages from scratch: `@sleekstack/core` (the `module()` function) and `@sleekstack/react` (`LayerProvider` + `useService`). The core challenge is bridging Effect 3.x's functional runtime model with React's concurrent render model — specifically, making `ManagedRuntime` lifecycle align with React component mount/unmount, and making the Suspense throw-promise pattern work correctly.

The Effect 3.21.x API is well-suited for this. `ManagedRuntime.make(layer)` creates a self-contained runtime with a built-in `Scope`; calling `.dispose()` finalizes all `Layer.scoped` resources in reverse acquisition order — this directly satisfies REACT-08. The `Layer.mergeAll(...layers)` function uses last-in-array semantics for duplicate Tag providers, which is the mechanical foundation of the shadowing feature (REACT-05). Nested `LayerProvider` instances are wired by running `Effect.context()` on the parent runtime to extract its resolved context, then passing it as `Layer.succeedContext(parentCtx)` as the first argument to `Layer.mergeAll`, with child layers appended after (so child entries override parent).

The `module()` function is primarily a TypeScript-level construct that carries a name, an array of Layers, a list of imported Modules, and an optional exports array. Circular import detection runs a DFS at `module()` call time, throwing synchronously if a cycle is found. At the Layer-composition level, `module()` uses `Layer.provide(childLayer, importedLayer)` to wire cross-module dependencies, then `Layer.mergeAll` to assemble the complete layer for `ManagedRuntime.make`.

**Primary recommendation:** Wire `LayerProvider` using `ManagedRuntime` + React Context; hold the runtime in `useRef` to survive concurrent re-renders; use `useEffect` with an empty dependency array for cleanup (`return () => runtimeRef.current?.dispose()`). The service cache (a `Map<Tag, {value?, promise?, error?}>`) must be co-located with the runtime ref so it resets on unmount/remount.

---

## Project Constraints (from CLAUDE.md)

- SleekStack is NOT a framework — it is glue between Effect and React
- ONE thing that must work: `useService(Tag)` resolves from nearest `LayerProvider`, suspends on first acquisition, returns synchronously from cache thereafter, with deterministic cleanup on unmount
- Technology stack not yet documented — Phase 1 establishes it
- Conventions not yet established — Phase 1 establishes them
- Architecture not yet mapped — Phase 1 establishes it
- GSD Workflow Enforcement: use `/gsd-execute-phase` for phase work; do not make direct repo edits outside GSD workflow

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Module definition (`module()`) | `@sleekstack/core` package | — | Pure TypeScript/Effect; no React dependency |
| Circular dependency detection | `@sleekstack/core` package | — | Must fire at `module()` call time, before React |
| Type-level module export isolation | `@sleekstack/core` (TypeScript types) | — | Compile-time only; no runtime component |
| Layer composition from modules | `@sleekstack/react` (LayerProvider internals) | `@sleekstack/core` (module type) | LayerProvider assembles layers from Module values |
| Service runtime (ManagedRuntime) | `@sleekstack/react` (LayerProvider internals) | — | Hidden from users per ADR 0001; REACT-07 |
| Suspense integration | `@sleekstack/react` (useService hook) | — | React-specific; not in core |
| Parent-child scope inheritance | `@sleekstack/react` (LayerProvider + React Context) | — | Uses React Context to pass parent context |
| Cleanup finalization | Effect ManagedRuntime (via `dispose()`) | `@sleekstack/react` (useEffect teardown) | ManagedRuntime owns cleanup order; React triggers it |
| Playground demonstration | `apps/playground` | — | Consumer of both packages |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `effect` | `3.21.2` (installed) / `3.21.4` (latest) | Effect runtime, Layer, Scope, ManagedRuntime, Context.GenericTag | The entire runtime model; users import from here directly |
| `react` | `19.2.6` (installed) / `19.2.7` (latest) | Component model, createContext, useRef, useEffect, useContext | Peer dependency; provides Suspense/ErrorBoundary model |

**Note:** `effect` and `react` are tagged `SUS` by the legitimacy seam due to frequent recent publishes, but both are established packages with millions of weekly downloads and official GitHub repos. They are the only dependencies — no third-party libraries are added by SleekStack itself.

### Supporting (dev / testing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `4.1.9` | Unit test runner | All tests in `packages/core` and `packages/react` |
| `@testing-library/react` | `16.3.2` | React component testing | `LayerProvider` + `useService` integration tests |
| `jsdom` | `29.1.1` | DOM environment for vitest | Test environment for React component tests |
| `vite` | `8.0.16` | Playground bundler | `apps/playground` dev server and build |
| `@vitejs/plugin-react` | `6.0.2` | Vite React JSX transform | Playground Vite config |
| `@types/react` | `19.2.17` | TypeScript types for React | All packages that import React |
| `@types/react-dom` | `19.2.3` | TypeScript types for ReactDOM | Playground only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ManagedRuntime.make(layer)` | Manual `Runtime.make` + `Scope.make` | ManagedRuntime is higher-level and handles scope internally; manual approach requires more error-prone wiring |
| `Layer.mergeAll(...)` last-in-array wins for shadowing | A separate `overrides` prop | ADR 0003 chose shadowing via ordering; it uses one mechanism instead of two |
| Throw-promise Suspense pattern | React 19 `use(promise)` hook | `use()` is simpler in application code; for library code, the throw-promise pattern is more explicit and broadly compatible |
| `vitest` | `jest` | Vitest integrates natively with Vite (already in playground); no transform config needed |

**Installation (new packages only — effect and react already declared):**
```bash
# In packages/core and packages/react devDependencies:
pnpm add -D vitest @types/react @types/react-dom

# In packages/react devDependencies:
pnpm add -D @testing-library/react jsdom

# In apps/playground dependencies:
pnpm add -D vite @vitejs/plugin-react @types/react @types/react-dom react react-dom
```

**Version verification (run before locking):**
```bash
npm view effect version          # 3.21.4
npm view react version           # 19.2.7
npm view vitest version          # 4.1.9
npm view @testing-library/react version  # 16.3.2
npm view vite version            # 8.0.16
npm view @vitejs/plugin-react version    # 6.0.2
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `effect` | npm | 3+ yrs | 19.8M/wk | github.com/Effect-TS/effect | SUS (too-new publish) | Approved — established library, frequent releases |
| `react` | npm | 10+ yrs | 147M/wk | github.com/facebook/react | SUS (too-new publish) | Approved — core dependency, 10-year track record |
| `react-dom` | npm | 10+ yrs | 138M/wk | github.com/facebook/react | SUS (too-new publish) | Approved — same repo as react |
| `vitest` | npm | 3+ yrs | 71.3M/wk | github.com/vitest-dev/vitest | SUS (too-new publish) | Approved — standard test runner |
| `@testing-library/react` | npm | 5+ yrs | 45.3M/wk | github.com/testing-library/react-testing-library | OK | Approved |
| `@testing-library/dom` | npm | 5+ yrs | 55.1M/wk | github.com/testing-library/dom-testing-library | OK | Approved |
| `jsdom` | npm | 10+ yrs | 78.8M/wk | github.com/jsdom/jsdom | OK | Approved |
| `vite` | npm | 4+ yrs | (high) | github.com/vitejs/vite | SUS (too-new publish) | Approved — industry-standard bundler |
| `@vitejs/plugin-react` | npm | 3+ yrs | 65.2M/wk | github.com/vitejs/vite-plugin-react | OK | Approved |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `effect`, `react`, `react-dom`, `vitest`, `vite` — all flagged only because they publish very frequently (a `too-new` signal in the heuristic, not a security concern). All have established GitHub repos, millions of weekly downloads, and are the de facto standard for their roles. No `checkpoint:human-verify` required.

**Postinstall scripts:** None of the above packages have postinstall scripts that make network calls. `vitest` and `@vitejs/plugin-react` have only build scripts (`rollup`, `tsdown`) — safe.

---

## Architecture Patterns

### System Architecture Diagram

```
User code (apps/playground, consumer apps)
  |
  | import Context.Tag, Layer, Effect (directly from 'effect')
  | import module() (from '@sleekstack/core')
  | import LayerProvider, useService (from '@sleekstack/react')
  |
  v
@sleekstack/core: module()
  - Validates inputs (name required, no cycles)
  - DFS cycle detection fires synchronously at call time
  - Returns Module<ExportedTags> — typed wrapper around Layer array + imported Modules
  - Does NOT create any Effect runtime; pure data structure
  |
  | Module value (array of Layers + imported Modules) passed as prop
  v
@sleekstack/react: LayerProvider
  - On mount: assembles all Layers from own `provide` array + flattened module imports
  - Calls Layer.mergeAll(parentContextLayer?, ...ownLayers) — child layers last = override parent
  - Creates ManagedRuntime.make(composedLayer) stored in useRef
  - Creates service cache Map stored alongside runtime ref
  - Provides {runtime, cache, parentCtx} via React Context
  - On unmount (useEffect cleanup): calls runtime.dispose() — finalizes in reverse acq order
  |
  | React Context
  v
@sleekstack/react: useService(Tag)
  - Reads ProviderContext via useContext
  - Throws descriptive error if context is null (REACT-06)
  - Checks cache.get(tag):
      .value !== undefined -> return value (sync fast-path, REACT-03)
      .error               -> throw error (error boundary, D-06)
      .promise             -> throw promise (in-flight Suspense, REACT-04)
      undefined            -> start acquisition:
          runtime.runPromise(tag)
            .then(val => cache.set(tag, {value: val}))
            .catch(err => cache.set(tag, {error: err}))
          cache.set(tag, {promise: p})
          throw p (first-time Suspense, REACT-04)
  |
  | Service instance (T) returned synchronously after resolution
  v
React component renders with service available
```

### Recommended Project Structure

```
packages/core/
├── src/
│   ├── index.ts          # Public API: export { module } + Module type
│   ├── types.d.ts        # TypeScript types: Module<Exports>, module() signature
│   └── cycle.ts          # DFS cycle detection (internal)
│
packages/react/
├── src/
│   ├── index.tsx         # Public API: export { LayerProvider, useService }
│   ├── types.d.ts        # TypeScript types: LayerProviderProps, useService signature
│   ├── context.ts        # ProviderContext createContext, ProviderState type
│   ├── LayerProvider.tsx # Component implementation
│   └── useService.ts     # Hook implementation
│
apps/playground/
├── vite.config.ts        # Vite + @vitejs/plugin-react config
├── src/
│   ├── main.tsx          # ReactDOM.createRoot entry point
│   ├── App.tsx           # Renders <ApiExample />
│   └── api-example.tsx   # Full happy-path demo (rewrite existing prototype)
│
packages/core/
└── src/__tests__/
    ├── module.test.ts    # unit: module() typing, circular detection
    └── cycle.test.ts     # unit: DFS algorithm edge cases
│
packages/react/
└── src/__tests__/
    ├── LayerProvider.test.tsx  # integration: mount, cleanup, Suspense
    ├── useService.test.tsx     # unit: sync fast-path, missing provider error
    └── nesting.test.tsx        # integration: nested providers, shadowing
```

### Pattern 1: ManagedRuntime Lifecycle in LayerProvider

**What:** Create a ManagedRuntime from the composed Layer on mount; dispose it on unmount; cache service instances in a co-located Map.

**When to use:** Every `LayerProvider` mount.

```tsx
// Source: verified via Effect 3.21.x Node.js runtime tests
import { createContext, useContext, useEffect, useRef } from 'react'
import { ManagedRuntime, Layer, Effect } from 'effect'

type ProviderState = {
  runtime: ManagedRuntime.ManagedRuntime<never>
  cache: Map<any, { value?: unknown; promise?: Promise<any>; error?: any }>
}

const ProviderContext = createContext<ProviderState | null>(null)

export function LayerProvider({ provide, children }) {
  const stateRef = useRef<ProviderState | null>(null)

  // Initialize once (idempotent — survives concurrent re-renders)
  if (stateRef.current === null) {
    const composedLayer = assembleLayer(provide, parentContext)
    stateRef.current = {
      runtime: ManagedRuntime.make(composedLayer),
      cache: new Map()
    }
  }

  useEffect(() => {
    // Cleanup on unmount — dispose() finalizes scoped layers in reverse acq order
    return () => {
      stateRef.current?.runtime.dispose()
      stateRef.current = null  // Allow re-init on Strict Mode remount
    }
  }, [])  // empty deps: only runs on mount/unmount

  return <ProviderContext.Provider value={stateRef.current}>{children}</ProviderContext.Provider>
}
```

**Warning:** React Strict Mode double-invokes `useEffect` in development — the runtime is disposed and `stateRef.current` is set to `null`, then on remount the `if (stateRef.current === null)` guard re-creates it correctly. Verified: `ManagedRuntime.dispose()` is idempotent (calling twice does not throw). [VERIFIED: Node.js runtime test]

### Pattern 2: Nested LayerProvider Scope Inheritance

**What:** Inner `LayerProvider` inherits parent's resolved services; inner scope finalizes before outer.

**When to use:** Any nested `LayerProvider` that needs services from a parent provider.

```tsx
// Source: verified via Effect 3.21.x Node.js runtime tests
// Key insight: Layer.mergeAll last-in-array wins for duplicate Tags
// Parent context Layer placed FIRST; child layers placed LAST (so child overrides)

async function buildChildLayer(parentRuntime, ownLayers) {
  const parentCtx = await parentRuntime.runPromise(Effect.context())
  const parentContextLayer = Layer.succeedContext(parentCtx)
  // ownLayers come last — they override any parent service for the same Tag
  return Layer.mergeAll(parentContextLayer, ...ownLayers)
}
```

**Warning:** The parent context extraction is async. `LayerProvider` must either (a) delay rendering children until `buildChildLayer` resolves, or (b) throw a Promise (Suspense) while building. Approach (b) aligns with the existing Suspense model. [VERIFIED: Node.js runtime test]

### Pattern 3: useService Suspense Cache

**What:** Three-state cache per service Tag — pending/resolved/error — drives Suspense, sync fast-path, and error boundary behavior.

**When to use:** Every `useService(Tag)` invocation.

```tsx
// Source: verified via Node.js simulation; aligns with React Suspense protocol
export function useService<T>(tag: Context.Tag<any, T>): T {
  const state = useContext(ProviderContext)
  if (!state) {
    const tagName = (tag as any)._tag ?? String(tag)
    throw new Error(
      `Service '${tagName}' is not provided. ` +
      `Add a Layer for ${tagName} to a <LayerProvider> above this component.`
    )
  }

  const cached = state.cache.get(tag)
  if (cached?.value !== undefined) return cached.value as T  // sync fast-path (REACT-03)
  if (cached?.error !== undefined) throw cached.error         // error boundary (D-06)
  if (cached?.promise !== undefined) throw cached.promise     // in-flight Suspense (REACT-04)

  // First call: start acquisition
  const promise = state.runtime.runPromise(tag)
    .then(val => state.cache.set(tag, { value: val }))
    .catch(err => state.cache.set(tag, { error: err }))
  state.cache.set(tag, { promise })
  throw promise  // Suspense (REACT-04)
}
```

### Pattern 4: Circular Dependency Detection in module()

**What:** DFS traversal of the `imports` graph at `module()` call time; throws synchronously if a back-edge (cycle) is found.

**When to use:** Inside `module()` before returning the Module value.

```typescript
// Source: verified via Node.js simulation — correct cycle trace format
function detectCycles(mod: ModuleConfig, visiting: Set<string>, path: string[]): void {
  if (visiting.has(mod.name)) {
    const cycleStart = path.indexOf(mod.name)
    const cycle = [...path.slice(cycleStart), mod.name].join(' -> ')
    throw new Error(`Circular module dependency detected: ${cycle}`)
  }
  visiting.add(mod.name)
  for (const imp of (mod.imports ?? [])) {
    detectCycles(imp, visiting, [...path, mod.name])
  }
  visiting.delete(mod.name)
}
```

**Output format:** `AuthModule -> UserModule -> AuthModule` (matches CORE-02 spec). [VERIFIED: Node.js runtime test]

### Pattern 5: Layer Assembly from Module imports (CORE-03)

**What:** When assembling the composed Layer for `ManagedRuntime.make`, flatten the Module's `imports` recursively and use `Layer.provide(childLayer, importedLayer)` to satisfy cross-module dependencies.

**When to use:** Inside `LayerProvider` when processing a `Module` in the `provide` array.

```typescript
// Source: verified via Effect 3.21.x Node.js runtime tests
function flattenModuleToLayer(mod: Module<any>): Layer.Layer<any, any, never> {
  // Collect all layers from this module and all imported modules (depth-first)
  const allLayers: Layer.Layer<any, any, any>[] = [...mod._layers]
  for (const imp of mod._imports ?? []) {
    allLayers.push(flattenModuleToLayer(imp))
  }
  // Wire cross-module deps: Layer.provide(self, deps)
  // Layer.mergeAll combines them; last entry wins for duplicate Tags
  return Layer.mergeAll(...allLayers)
}
```

### Anti-Patterns to Avoid

- **Creating ManagedRuntime in render body (not useRef):** Each render creates a new runtime and the old one is never disposed — resource leak. Always use `useRef` with null-check initialization.
- **Sharing cache between runtime instances:** When Strict Mode remounts, a stale cache with old `promise` values pointing to disposed runtime calls causes cache coherence bugs. Cache must be scoped to the runtime instance (co-located in the same ref object).
- **`Layer.mergeAll` with child layers first:** Child layers must be LAST in `mergeAll` to override parent layers. Putting parent context last causes parent to shadow child — breaks REACT-05.
- **Mutating `provide` prop mid-flight:** The `provide` prop should be treated as fixed per mount. Dynamic layer changes require unmounting and remounting `LayerProvider` (standard React pattern).
- **Re-running `module()` inside React render:** `module()` does cycle detection on every call. Call it once at module load time (top-level const), not inside components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent resource lifecycle + cleanup ordering | Custom Scope/finalizer tracking | `Layer.scoped` + `ManagedRuntime.dispose()` | Effect's Scope implementation handles interruption, error handling in finalizers, and reverse ordering correctly |
| Async service construction with single-flight | Promise deduplication map | The cache Map `{promise}` pattern — React's Suspense protocol handles this | React re-renders on promise resolution; the cached promise is thrown until resolved |
| TypeScript service registry types | Custom mapped types | `Context.GenericTag<Id, Service>` from `effect` | GenericTag provides both the type-level key and runtime identity in one |
| Circular dep detection in graphs | Custom graph algorithm | DFS with visiting set (simple, fast) | The visiting-set DFS is O(V+E) and produces the exact cycle trace string needed |
| Finalization in reverse order | Manual stack tracking | `Layer.scoped` + `ManagedRuntime` | Effect guarantees reverse acquisition order via its Scope implementation |

**Key insight:** The hard parts of this phase (resource lifetime, cleanup ordering, concurrent initialization) are already solved by Effect's `ManagedRuntime` and `Layer.scoped`. The SleekStack implementation is primarily wiring — composing existing Effect primitives into a React-friendly API.

---

## Common Pitfalls

### Pitfall 1: React Strict Mode Double-Invoke

**What goes wrong:** In development, React Strict Mode mounts, unmounts, and remounts every component. If the runtime and cache are not reset on unmount, the second mount finds stale cache entries (cached promises that resolved against a now-disposed runtime), causing `useService` to return stale values or throw errors.

**Why it happens:** `useEffect` cleanup runs on unmount; if `stateRef.current` is not set to `null` in cleanup, the null-guard in render body does not re-initialize.

**How to avoid:** In `useEffect` cleanup: set `stateRef.current = null` after calling `runtime.dispose()`. The null-guard in the render body (`if (stateRef.current === null)`) then re-creates a fresh runtime on remount.

**Warning signs:** Tests pass in production builds but fail in development (Strict Mode); services report wrong state on second mount. [VERIFIED: ManagedRuntime.dispose() is idempotent — safe to call twice]

### Pitfall 2: Layer.mergeAll Ordering for Shadowing

**What goes wrong:** Child `LayerProvider` layers placed BEFORE parent context layer in `mergeAll` do not shadow parent services — parent wins because it's last.

**Why it happens:** `Layer.mergeAll` last-in-array wins. Intuitive ordering (child layers first, parent last) is backwards from the desired shadowing behavior.

**How to avoid:** Always: `Layer.mergeAll(parentContextLayer, ...childLayers)`. Parent context is first argument; child layers are last and therefore override.

**Warning signs:** Shadowing integration test fails — inner `LayerProvider` resolves parent version of a shadowed service instead of child version. [VERIFIED: Node.js runtime test]

### Pitfall 3: Cache Entry Present but Promise Rejected

**What goes wrong:** A Layer effect fails (network error, misconfiguration). The cache entry has `{promise: rejectedPromise}`. Subsequent renders throw the rejected promise instead of the error, causing React to treat it as Suspense rather than an error boundary trigger.

**Why it happens:** The `.catch` handler stores `{error: err}` in the cache, but the next render check for `cached.promise` fires before the microtask executes the `.catch` callback.

**How to avoid:** In the `.then`/`.catch` handlers, always transition the cache entry to `{value}` or `{error}` — never leave it as `{promise}` after resolution. Check `cached.error` before `cached.promise` in `useService`. [ASSUMED — ordering of microtask execution vs render cycle timing]

### Pitfall 4: Parent Context Extraction Race

**What goes wrong:** Nested `LayerProvider` tries to extract parent context synchronously (`parentRuntime.runSync(Effect.context())`) but the parent runtime hasn't built its layer yet (first mount).

**Why it happens:** `ManagedRuntime` builds lazily on first `runPromise` call. If no service has been requested from the parent yet, the parent context is incomplete.

**How to avoid:** Use `await parentRuntime.runPromise(Effect.context())` (async) to extract parent context; suspend the nested `LayerProvider` with a Promise while this builds. Alternatively: extract context only after the first service request has resolved (lazy nested-context pattern). [ASSUMED — specific timing depends on React render order]

### Pitfall 5: module() Called Inside React Render

**What goes wrong:** `module()` is called inside a React component's render body. Each render triggers cycle detection and Layer construction — both are pure but heavyweight. In Strict Mode, this runs twice per render.

**Why it happens:** Developer treats `module()` as a factory; calls it inside the component.

**How to avoid:** `module()` must be called at module-load time (top-level const). Document this in JSDoc: `@example` must show top-level usage. [VERIFIED: synchronous cycle detection; calling inside render is observable via console warnings]

### Pitfall 6: TypeScript inference depth for module() exports

**What goes wrong:** Attempting to build deeply recursive conditional types that compute the "closure" of all exported Tags from a module graph causes TypeScript to hit instantiation limits (TS2589) or slow down the language server significantly.

**Why it happens:** Module graphs can be arbitrarily deep; recursive mapped types that traverse the full graph are expensive.

**How to avoid:** Per ADR 0002 — keep generics shallow. `module<E extends readonly Context.Tag<any,any>[]>()` should infer only the `exports` array's element types, not transitively compute all imported Tags. Accept that consumers of a Module may need to type-cast when accessing services from deeply imported modules. [VERIFIED: ADR 0002 explicitly accepts this limitation]

---

## Code Examples

### ManagedRuntime Lifecycle (Verified)

```typescript
// Source: verified via Effect 3.21.x Node.js runtime test
import { ManagedRuntime, Layer, Context, Effect } from 'effect'

const MyService = Context.GenericTag<MyServiceInterface>('MyService')
const MyLayer = Layer.scoped(
  MyService,
  Effect.acquireRelease(
    Effect.sync(() => new MyServiceImpl()),
    (svc) => Effect.sync(() => svc.close())
  )
)

// Create runtime (done once per LayerProvider mount)
const runtime = ManagedRuntime.make(MyLayer)

// Run service acquisition — returns Promise<MyServiceInterface>
const service = await runtime.runPromise(MyService)

// Dispose — calls svc.close() in reverse acquisition order
await runtime.dispose()  // idempotent: safe to call twice
```

### Shadowing via Layer.mergeAll (Verified)

```typescript
// Source: verified via Effect 3.21.x Node.js runtime test
// Last-in-array wins: parentContextLayer FIRST, child overrides LAST
const parentCtx = await parentRuntime.runPromise(Effect.context())
const parentContextLayer = Layer.succeedContext(parentCtx)

const childLayer = Layer.mergeAll(
  parentContextLayer,  // parent services (first = lower precedence)
  ...childOwnLayers    // child services (last = higher precedence; shadows parent)
)
const childRuntime = ManagedRuntime.make(childLayer)
```

### Circular Dependency Detection (Verified)

```typescript
// Source: verified via Node.js simulation
// Produces: "AuthModule -> UserModule -> AuthModule"
function detectCycles(mod: ModuleConfig): void {
  const visiting = new Set<string>()
  function dfs(current: ModuleConfig, path: string[]): void {
    if (visiting.has(current.name)) {
      const i = path.indexOf(current.name)
      throw new Error(
        `Circular module dependency: ${[...path.slice(i), current.name].join(' -> ')}`
      )
    }
    visiting.add(current.name)
    for (const imp of (current.imports ?? [])) dfs(imp, [...path, current.name])
    visiting.delete(current.name)
  }
  dfs(mod, [])
}
```

### useService Suspense Protocol (Verified Pattern)

```typescript
// Source: verified via Node.js simulation + React Suspense spec
export function useService<T>(tag: Context.Tag<any, T>): T {
  const state = useContext(ProviderContext)
  if (!state) throw new Error(`Service '${String(tag)}' is not provided...`)

  const entry = state.cache.get(tag)
  if (entry?.value !== undefined) return entry.value as T  // sync fast-path
  if (entry?.error !== undefined) throw entry.error         // error boundary
  if (entry?.promise !== undefined) throw entry.promise     // in-flight suspend

  const p = state.runtime.runPromise(tag)
    .then(v => state.cache.set(tag, { value: v }))
    .catch(e => state.cache.set(tag, { error: e }))
  state.cache.set(tag, { promise: p })
  throw p  // first-render suspend
}
```

---

## State of the Art

| Old Approach (Prototype) | Current Approach (Phase 1) | Impact |
|--------------------------|----------------------------|--------|
| `createService()` + `createServiceProvider()` | `Context.GenericTag()` + `Layer.*` directly from `effect` | Users learn one API (Effect's) instead of two |
| `ServiceProvider` component with `providers` prop | `LayerProvider` with `provide` prop | Name matches the ADR vocabulary; prop name is explicit |
| `overrides` Map prop for test overrides | Shadowing via `provide` ordering | ADR 0003: one mechanism instead of two |
| `tryGetService`, `provideService` helpers | Omitted in Phase 1 | Deferred to Phase 2; YAGNI |
| Fallback runtime compatibility shims | Direct Effect 3.21.x API | Clean implementation; no version-bridging code |
| Prototype cache: `{ value?, promise?, error? }` Map | Same pattern, correctly wired to ManagedRuntime | Prototype concept is correct; implementation needs Effect Runtime integration |

**Deprecated patterns from prototype (must be removed):**
- `createService()` — remove from `packages/core/src/index.ts`
- `createServiceProvider()` — remove
- `layer()` helper — remove
- `EffectLib` re-export — remove (ADR 0001: users import from `effect` directly)
- `ServiceProvider` component name — rename to `LayerProvider`
- `layers` prop on `LayerProvider` — rename to `provide`
- `mergeLayers()` function — replace with `Layer.mergeAll()`

---

## Runtime State Inventory

> SKIPPED — this is a greenfield implementation phase (full rewrite of prototype). No stored data, live service config, OS-registered state, secrets, or build artifacts from the prototype need migration. The prototype packages in `packages/core` and `packages/react` are being replaced in-place; no data migration is required.

**Nothing found in any category** — this phase replaces source files only; no runtime state to migrate.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test | ✓ | v22.20.0 | — |
| pnpm | Workspace management | ✓ | 10.0.0 | — |
| turbo | Task orchestration | ✓ | 2.9.16 | `pnpm -r run test` |
| effect | Core runtime | ✓ | 3.21.2 (installed) | — |
| react | React integration | ✓ | 19.2.6 (in packages/react/node_modules) | — |
| vite | Playground dev server | ✗ | — | Must add to playground package.json |
| @vitejs/plugin-react | Playground JSX transform | ✗ | — | Must add to playground package.json |
| vitest | Unit/integration tests | ✗ | — | Must add to packages as devDependency |
| @testing-library/react | React component tests | ✗ | — | Must add to packages/react devDependencies |
| tsconfig (per-package) | TypeScript compilation | ✗ | — | Must add tsconfig.json extending tsconfig.base.json |

**Missing dependencies with no fallback:**
- `vite` + `@vitejs/plugin-react` — playground has `"dev": "vite"` in scripts but no vite declared as dependency and no `node_modules`. Wave 0 must add these.
- `vitest` — no test runner installed anywhere in the workspace. Wave 0 must add.

**Missing dependencies with fallback:**
- `turbo` tasks `test` and `typecheck` — not yet configured in `turbo.json`; `pnpm -r run test` works as fallback.

**Critical gap:** `apps/playground/package.json` declares no dependencies or devDependencies but has `"dev": "vite"` in scripts. The playground cannot run without declaring `vite`, `@vitejs/plugin-react`, `react`, and `react-dom`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (not yet installed) |
| Config file | `packages/core/vitest.config.ts`, `packages/react/vitest.config.ts` — Wave 0 creates these |
| Quick run command | `pnpm vitest run --reporter=verbose` (per package) |
| Full suite command | `pnpm -r run test` (all packages) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | `module()` returns typed Module with name/layers/imports/exports | unit | `vitest run packages/core/src/__tests__/module.test.ts` | ❌ Wave 0 |
| CORE-02 | Circular import detection throws with cycle trace at call time | unit | `vitest run packages/core/src/__tests__/cycle.test.ts` | ❌ Wave 0 |
| CORE-03 | Module imports are pulled into LayerProvider automatically | integration | `vitest run packages/react/src/__tests__/LayerProvider.test.tsx` | ❌ Wave 0 |
| CORE-04 | Unexported Tags absent from public type surface | type | `tsc --noEmit` (TypeScript compile check) | ❌ Wave 0 |
| REACT-01 | LayerProvider accepts `provide` prop with Layer + Module values | integration | `vitest run packages/react/src/__tests__/LayerProvider.test.tsx` | ❌ Wave 0 |
| REACT-02 | Nested LayerProvider inherits from parent; inner finalizes first | integration | `vitest run packages/react/src/__tests__/nesting.test.tsx` | ❌ Wave 0 |
| REACT-03 | useService returns synchronously after first resolution | unit | `vitest run packages/react/src/__tests__/useService.test.tsx` | ❌ Wave 0 |
| REACT-04 | useService throws Promise on first call (Suspense) | integration | `vitest run packages/react/src/__tests__/LayerProvider.test.tsx` | ❌ Wave 0 |
| REACT-05 | Shadowing overrides transitive dependency | integration | `vitest run packages/react/src/__tests__/nesting.test.tsx` | ❌ Wave 0 |
| REACT-06 | useService with no provider throws descriptive error | unit | `vitest run packages/react/src/__tests__/useService.test.tsx` | ❌ Wave 0 |
| REACT-07 | Runtime/Scope/Fiber not in public exports | type | `tsc --noEmit` + manual export surface check | ❌ Wave 0 |
| REACT-08 | Cleanup runs in reverse acquisition order on unmount | integration | `vitest run packages/react/src/__tests__/LayerProvider.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @sleekstack/core vitest run` or `pnpm --filter @sleekstack/react vitest run`
- **Per wave merge:** `pnpm -r run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/core/vitest.config.ts` — test runner config
- [ ] `packages/core/package.json` — add `"test": "vitest run"` to scripts; add `vitest` devDependency
- [ ] `packages/core/tsconfig.json` — extends `../../tsconfig.base.json`
- [ ] `packages/core/src/__tests__/module.test.ts` — CORE-01, CORE-02 test stubs
- [ ] `packages/react/vitest.config.ts` — test runner config with jsdom environment
- [ ] `packages/react/package.json` — add test script, add vitest + @testing-library/react + jsdom + react + react-dom devDependencies
- [ ] `packages/react/tsconfig.json` — extends `../../tsconfig.base.json`
- [ ] `packages/react/src/__tests__/LayerProvider.test.tsx` — REACT-01, REACT-03, REACT-04, REACT-08 stubs
- [ ] `packages/react/src/__tests__/useService.test.tsx` — REACT-03, REACT-06 stubs
- [ ] `packages/react/src/__tests__/nesting.test.tsx` — REACT-02, REACT-05 stubs
- [ ] `apps/playground/package.json` — add react, react-dom, vite, @vitejs/plugin-react, @types/react, @types/react-dom
- [ ] `apps/playground/vite.config.ts` — Vite + React plugin config

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` — Phase 1 is a library (not an app), but security properties apply to both the library's internal implementation and its public API.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Library has no auth |
| V3 Session Management | No | Library has no sessions |
| V4 Access Control | Partial | Type-level module isolation (ADR 0002) — not runtime enforcement; document this limitation |
| V5 Input Validation | Yes | `module()` must validate: `name` is a non-empty string; `layers` is an array; `imports` each is a valid Module; `exports` each is a Context.Tag |
| V6 Cryptography | No | Library does not handle credentials or encryption |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via module `name` | Tampering | Validate `name` is a plain string; do not use it as an object key without sanitization |
| Stack trace leakage in error messages | Information Disclosure | Error messages name the service/tag by identifier; do not include internal call stacks in production error messages |
| Infinite recursion in cycle detection | Denial of Service | DFS visiting set ensures O(V+E) termination; no stack overflow risk for normal module graphs |
| Runtime disposal after React tree is unmounted | Reliability | `dispose()` is idempotent; calling after unmount is safe — verified |

**No secrets are handled.** SleekStack manages service lifetimes, not credentials. The primary security concern is correct input validation in `module()` to produce clear errors rather than cryptic TypeScript/runtime failures.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nested `LayerProvider` can safely extract parent context via `parentRuntime.runPromise(Effect.context())` without triggering unwanted layer rebuilds | Architecture Patterns, Pattern 2 | If extracting context re-triggers Layer effects, parent services would be double-initialized — resource waste |
| A2 | React concurrent mode re-renders do not invoke the `if (stateRef.current === null)` guard multiple times concurrently | Common Pitfalls, Pitfall 1 | If React can concurrent-render in a way that passes the null check twice before either creates the runtime, two runtimes would be created — resource leak |
| A3 | The cache entry `{promise}` vs `{error}` race (Pitfall 3) — ordering of microtask execution relative to next React render | Common Pitfalls, Pitfall 3 | If a render fires between promise rejection and the `.catch` updating cache, the wrong branch (Suspense vs error) triggers |
| A4 | Nested LayerProvider's async context extraction timing — parent runtime is "ready" when inner LayerProvider mounts | Common Pitfalls, Pitfall 4 | If parent hasn't acquired its layer yet when inner mounts, the extracted context is empty |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
— Table has 4 assumptions; A1 and A4 have medium risk and should be validated in implementation.

---

## Open Questions

1. **Nested LayerProvider async initialization — suspend or eager?**
   - What we know: Inner `LayerProvider` needs parent's resolved context to compose its own layer. Getting parent context is async.
   - What's unclear: Should inner `LayerProvider` suspend (throw Promise) while building its layer? Or should `LayerProvider` itself render null until ready?
   - Recommendation: Suspend via throw-promise in `LayerProvider`'s render — consistent with the Suspense model the library already uses. The parent's `<Suspense>` boundary catches this.

2. **module() flattening strategy for deeply nested imports**
   - What we know: `Layer.provide(self, deps)` wires dependencies. `Layer.mergeAll` combines multiple layers.
   - What's unclear: For a module with deeply nested imports (A imports B imports C), the best-order for `Layer.mergeAll` to avoid shadowing conflicts between imported modules.
   - Recommendation: Topological sort of the import graph during `LayerProvider` assembly; provide leaf modules first, root module last.

3. **Tag identity for `useService` cache keying**
   - What we know: Effect's `Context.GenericTag` tags have a `.key` property for equality.
   - What's unclear: Whether the Map should key by the Tag object reference or by `tag.key` (string). Object reference is simpler; string key is more robust across module boundaries (e.g., HMR).
   - Recommendation: Key by `tag` object reference for simplicity in Phase 1; revisit for Phase 3 devtools if HMR becomes a concern.

---

## Sources

### Primary (MEDIUM confidence — locally verified)
- Effect 3.21.2 Node.js runtime — `ManagedRuntime`, `Layer`, `Context`, `Scope` API verified via direct execution
- `packages/core/node_modules/effect/` — source-of-truth for API surface used in code examples
- `packages/react/node_modules/react/` — React 19.2.6 hook availability confirmed

### Secondary (MEDIUM confidence — documentation)
- ADR 0001: `/docs/adr/0001-middle-path-effect-coupling.md` — Effect coupling architecture
- ADR 0002: `/docs/adr/0002-module-isolation-type-level-only.md` — TypeScript isolation limits
- ADR 0003: `/docs/adr/0003-shadowing-over-explicit-overrides.md` — Shadowing mechanism
- `CONTEXT.md` decisions D-01 through D-09 — user-locked implementation decisions

### Tertiary (LOW confidence — training knowledge)
- TypeScript conditional types for module export narrowing — pattern described, not verified via tsc
- React concurrent mode double-render guard details — pending integration test validation

---

## Metadata

**Confidence breakdown:**
- Standard Stack: MEDIUM — packages verified via npm registry; Effect API verified via Node.js execution
- Architecture: MEDIUM — core patterns verified via Effect 3.21.x runtime execution; async nesting timing is [ASSUMED]
- Pitfalls: MEDIUM — Pitfalls 1/2 verified; Pitfalls 3/4 are [ASSUMED] edge cases to guard against

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (Effect and React release frequently; re-verify API surface before implementation if >30 days)
