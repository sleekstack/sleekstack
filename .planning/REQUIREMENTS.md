# Requirements

**Project:** SleekStack  
**Status:** Active  
**Last updated:** 2026-06-20

---

## v1 Requirements

### Core Runtime (@sleekstack/core)

- [x] **CORE-01**: `module()` accepts `name` (required), `layers`, `imports?`, `exports?` fields and returns a typed Module
- [x] **CORE-02**: `module()` detects circular imports at definition time and throws with a full cycle trace (e.g. `AuthModule → UserModule → AuthModule`)
- [x] **CORE-03**: Module `imports` are automatically pulled into any `LayerProvider` that includes the module; no manual re-declaration required
- [x] **CORE-04**: Module `exports` provide best-effort type-level isolation — exported Tags are surfaced to consumers, unexported Tags are not in the public type surface

### React Integration (@sleekstack/react)

- [x] **REACT-01**: `LayerProvider` accepts a `provide` prop that takes an array of Effect `Layer` values and `Module` values
- [x] **REACT-02**: Nested `LayerProvider` inherits services from the parent scope; inner scope finalizes before outer scope on unmount
- [x] **REACT-03**: `useService(Tag)` returns the service synchronously if already resolved in the current scope (sync-fast-path)
- [x] **REACT-04**: `useService(Tag)` throws a Promise (Suspense integration) on first call when the service requires async resolution
- [x] **REACT-05**: A replacement in the `provide` array shadows a transitive dependency introduced via `imports` (shadowing override mechanism — no separate overrides prop)
- [x] **REACT-06**: Calling `useService(Tag)` when `Tag` is not provided in any ancestor `LayerProvider` throws a descriptive error: `"Service 'X' is not provided. Add XLayer to a LayerProvider above <Component>."`
- [x] **REACT-07**: Effect `Runtime`, `Scope`, and `Fiber` are never exposed to users; `Context.Tag`, `Layer`, and `Effect` are the user-facing primitives (imported directly from `effect`)
- [x] **REACT-08**: Services acquired within a `LayerProvider` scope are finalized (cleanup runs) when the `LayerProvider` unmounts, in reverse acquisition order

### Next.js Integration (@sleekstack/next)

- [ ] **NEXT-01**: `configureRuntime({ provide: [...] })` registers a global root layer for all server-side requests (called once in `instrumentation.ts`)
- [ ] **NEXT-02**: `action(factory)` wraps a Next.js Server Action and runs the Effect generator in a per-request scope with access to the global runtime layer
- [ ] **NEXT-03**: `query(factory)` wraps a server-side data fetch and runs the Effect generator in a per-request scope
- [ ] **NEXT-04**: `action({ provide: [...] }, factory)` accepts per-action layer overrides that shadow the global runtime layer

---

## v2 Requirements (Deferred)

- `@sleekstack/devtools` — graph visualization, dependency explorer, lifecycle tracing, Suspense waterfall analysis
- `@sleekstack/testing` — `TestClock`, deterministic scheduling, service interaction assertions (shadowing covers primary testing use case)
- `@sleekstack/query` — client-side Suspense-native query/cache integration
- `@sleekstack/rpc` — end-to-end typed RPC with transport abstraction
- `@sleekstack/auth`, `@sleekstack/db`, `@sleekstack/jobs`, `@sleekstack/realtime` — ecosystem packages

---

## Out of Scope

- Custom Effect runtime — Effect TS already provides this
- Decorators, runtime reflection, mutable DI containers — explicitly anti-pattern
- Airtight type-level module enforcement — TypeScript inference limits (recursive types, slow IDE); best-effort only
- React/Next.js replacement — SleekStack augments, does not replace
- New compiler or rendering engine

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Complete |
| CORE-03 | Phase 1 | Complete |
| CORE-04 | Phase 1 | Complete |
| REACT-01 | Phase 1 | Complete |
| REACT-02 | Phase 1 | Pending (Plan 01-04) |
| REACT-03 | Phase 1 | Complete |
| REACT-04 | Phase 1 | Complete |
| REACT-05 | Phase 1 | Pending (Plan 01-04) |
| REACT-06 | Phase 1 | Complete |
| REACT-07 | Phase 1 | Complete |
| REACT-08 | Phase 1 | Complete |
| NEXT-01 | Phase 2 | Pending |
| NEXT-02 | Phase 2 | Pending |
| NEXT-03 | Phase 2 | Pending |
| NEXT-04 | Phase 2 | Pending |
| Devtools scope | Phase 3 | Pending (scope TBD at planning time) |
