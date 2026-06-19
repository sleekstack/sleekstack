# Phase 1: Core Runtime - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement `@sleekstack/core` and `@sleekstack/react` from scratch — the foundational runtime that proves React + Effect service graphs work correctly. Deliverables: `module()` function, `LayerProvider` component, `useService()` hook, plus a fully runnable playground demo.

This phase rewrites the existing prototype packages. The current `packages/core` and `packages/react` are starting points only — their implementations diverge from the target API and will be fully replaced.

</domain>

<decisions>
## Implementation Decisions

### Suspense boundary ownership
- **D-01:** User owns the `<Suspense>` boundary — `LayerProvider` does NOT auto-wrap children. Standard React concurrent pattern; users place `<Suspense fallback={<Loading />}>` wherever they want loading states.
- **D-02:** JSDoc on `LayerProvider` and `useService` must explicitly document the Suspense boundary requirement with a usage example. Omitting this causes confusing blank renders.

### Non-suspending API surface
- **D-03:** `tryGetService`, `provideService`, and `ServiceOverrides` are NOT shipped in Phase 1. These exist in the prototype's `types.d.ts` but are not required. Phase 1 exports only `LayerProvider` + `useService`.
- **D-04:** The `packages/react/src/types.d.ts` is rewritten from scratch to match the target API exactly — remove all prototype-era types.
- **D-05:** The `packages/core/src/types.d.ts` is also rewritten — remove `createService`, `createServiceProvider`, `ServiceProvider`, `ServiceFactory`, etc. Core exports only `module()` and the `Module` type (per ADR 0001).

### Layer acquisition failure propagation
- **D-06:** When a Layer's Effect fails during acquisition, `useService` throws the error on the next render — caught by the nearest React `<ErrorBoundary>`. This mirrors the Suspense protocol: pending → throw Promise, failed → throw Error.
- **D-07:** `LayerProvider` has NO error recovery mechanism (no `onError` prop, no retry). Error propagation is fully the user's responsibility via React error boundaries. Clean separation.

### Playground demo
- **D-08:** Phase 1 delivers a fully runnable playground (`apps/playground`) demonstrating the core happy path: `module()` with imports, `LayerProvider` with `provide`, `useService()` resolving, and nested provider with shadowing.
- **D-09:** The playground covers all 6 ROADMAP success criteria: module compilation + types, circular dep detection (throw), service resolution via Suspense, shadowing a transitive dep, missing service error, cleanup on unmount.

### Claude's Discretion
- Internal Effect runtime management (how `ManagedRuntime`, `Scope`, and `Fiber` are wired inside `LayerProvider`) — follow Effect TS best practices
- TypeScript generics depth for `module()` exports narrowing — best-effort per ADR 0002
- Vitest test structure and file organization within packages
- Effect version-specific API choices (Effect 3.x)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked architecture decisions
- `docs/adr/0001-middle-path-effect-coupling.md` — Effect coupling: `@sleekstack/core` exports ONLY `module()`; users import Tag/Layer/Effect directly from `effect`
- `docs/adr/0002-module-isolation-type-level-only.md` — Module isolation is type-level only; no runtime enforcement
- `docs/adr/0003-shadowing-over-explicit-overrides.md` — Shadowing via `provide` ordering; no separate overrides prop

### Domain vocabulary
- `CONTEXT.md` (root) — Canonical terms: Tag, Layer, Service, Module, LayerProvider, Scope, Shadowing, Request Scope, Action, Query. Use these names exactly; avoid terms in the "Avoid" lists.

### Requirements
- `.planning/REQUIREMENTS.md` — v1 requirements CORE-01 through REACT-08 (Phase 1 scope)
- `.planning/ROADMAP.md` — Phase 1 goal and 6 success criteria

### Existing prototype (to be rewritten — read for context only)
- `packages/core/src/index.ts` — Current prototype implementation (old API, diverges from target)
- `packages/react/src/index.tsx` — Current prototype implementation (uses `layers` prop, old cache approach)
- `packages/react/DESIGN.md` — Design notes with old terminology; useful for understanding intent but terminology is outdated

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/react/src/index.tsx`: `ProviderContext` + `createContext` pattern — React context structure is reusable; the cache Map approach for sync-fast-path is directionally correct but needs Effect Runtime integration
- `apps/playground/src/App.tsx`: entry point renders `ApiExample` — structure is fine, `api-example.tsx` needs to be written
- `pnpm-workspace.yaml`: workspace already configured for `packages/*` and `apps/*`

### Established Patterns
- Effect v3 API: `Context.Tag`, `Layer.succeed`, `Layer.scoped`, `Effect.gen`, `ManagedRuntime.make` — these are the primitives `LayerProvider` wraps internally
- Monorepo: `packages/core` → `packages/react` dependency is already declared in package.json; `@sleekstack/core` is a peer dep of `@sleekstack/react`
- TypeScript strict: all packages use strict mode; generic inference limits apply (ADR 0002 accepted these)

### Integration Points
- `packages/react` imports `module()` return type from `@sleekstack/core` for the `provide` prop typing
- `apps/playground` imports `{ module }` from `@sleekstack/core` and `{ LayerProvider, useService }` from `@sleekstack/react`
- Effect imported directly from `effect` by users — SleekStack does not re-export it

</code_context>

<specifics>
## Specific Ideas

- Suspense + error boundary usage should be shown explicitly in the playground demo so the pattern is visible to library users
- The circular dep error at `module()` call time should include the full cycle trace string (e.g., `AuthModule → UserModule → AuthModule`) per CORE-02

</specifics>

<deferred>
## Deferred Ideas

- `tryGetService` — non-suspending variant; defer to Phase 2 when real use cases emerge
- `provideService()` utility — prototype concept, not required; defer to Phase 2 if needed
- `@sleekstack/testing` — explicit deferred decision from PROJECT.md; shadowing covers primary test use case
- Full DX error showcase in playground (missing service, circular dep demo) — Phase 1 playground covers happy path only; error DX demo is deferred

</deferred>

---

*Phase: 1-core-runtime*
*Context gathered: 2026-06-20*
