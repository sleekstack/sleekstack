# Phase 1: Core Runtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 1-core-runtime
**Areas discussed:** Suspense boundary ownership, Non-suspending useService variant, Layer acquisition failure propagation, Playground demo scope

---

## Suspense boundary ownership

| Option | Description | Selected |
|--------|-------------|----------|
| User owns it | Standard React pattern — users place `<Suspense>` wherever they want loading states. Full control. | ✓ |
| LayerProvider auto-wraps | LayerProvider wraps children in `<Suspense fallback={null}>` internally. Convenient but removes control. | |

**User's choice:** User owns the Suspense boundary

**Follow-up — JSDoc documentation:**

| Option | Description | Selected |
|--------|-------------|----------|
| Document it clearly | JSDoc on LayerProvider and useService notes the Suspense requirement with example | ✓ |
| Standard React knowledge | No extra guidance; power users know React | |

**Notes:** Documenting the Suspense requirement is a DX win — saves debugging time for first-time users.

---

## Non-suspending useService variant

| Option | Description | Selected |
|--------|-------------|----------|
| Skip for Phase 1 | YAGNI — only add tryGetService when real use cases emerge | ✓ |
| Include in Phase 1 | More complete API from start; useful for testing and progressive enhancement | |

**User's choice:** Skip `tryGetService` for Phase 1

**Follow-up — prototype types cleanup:**

| Option | Description | Selected |
|--------|-------------|----------|
| Remove both (provideService + ServiceOverrides) | Clean break from prototype; rewrite types.d.ts to match target API | ✓ |
| Keep as @internal stubs | Less churn but leaves dead code | |

**Notes:** Both `packages/react/src/types.d.ts` and `packages/core/src/types.d.ts` will be rewritten from scratch. No backward compat shims.

---

## Layer acquisition failure propagation

| Option | Description | Selected |
|--------|-------------|----------|
| Throw to React error boundary | useService throws the error on next render; caught by `<ErrorBoundary>`. Standard React pattern. | ✓ |
| onError prop on LayerProvider | Explicit error callback; adds API surface, doesn't compose with React error boundaries | |
| You decide | Leave to implementation; follow Effect + React best practices | |

**User's choice:** Throw to React error boundary

**Follow-up — LayerProvider error recovery:**

| Option | Description | Selected |
|--------|-------------|----------|
| Fully user responsibility | LayerProvider propagates errors up; users add ErrorBoundary | ✓ |
| LayerProvider retries | Retry N times before propagating. Adds complexity, hides failures | |

**Notes:** Clean separation — LayerProvider only manages the Effect scope lifecycle, not error recovery policy.

---

## Playground demo scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full working demo | Runnable app demonstrating module(), LayerProvider, useService, shadowing, and cleanup | ✓ |
| Type-checking scaffold | Compiles and type-checks but doesn't need to fully run | |
| Skip for Phase 1 | Focus on library packages only | |

**User's choice:** Full working demo

**Follow-up — what to showcase:**

| Option | Description | Selected |
|--------|-------------|----------|
| Core happy path | module() with imports, LayerProvider provide, useService resolving, nested provider with shadowing | ✓ |
| Full DX walkthrough | Also: missing service error display, circular dep detection demo, cleanup visible in console | |

**Notes:** Happy path covers all 6 ROADMAP success criteria. Error DX demo is deferred to a future iteration.

---

## Claude's Discretion

- Internal Effect runtime management (ManagedRuntime, Scope, Fiber wiring inside LayerProvider)
- TypeScript generics depth for `module()` exports narrowing
- Vitest test structure and file organization
- Effect v3 API choices

## Deferred Ideas

- `tryGetService` — non-suspending variant; defer to Phase 2
- `provideService()` — prototype concept, not required; defer if needed
- Full DX error showcase in playground (missing service error, circular dep demo)
- `@sleekstack/testing` — explicitly deferred in PROJECT.md
