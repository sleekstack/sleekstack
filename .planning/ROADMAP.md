---
project: SleekStack
created: 2026-06-20
granularity: standard
phase_id_convention: sequential
milestone: 1
---

# SleekStack Roadmap

## Core Value

`useService(Tag)` resolves a service from the nearest `LayerProvider`, suspending on first acquisition and returning synchronously from cache thereafter — with deterministic cleanup on unmount.

---

## Phases

- [ ] **Phase 1: Core Runtime** - Implement @sleekstack/core and @sleekstack/react; prove React + Effect service graphs work
- [ ] **Phase 2: Next.js Integration** - Implement @sleekstack/next with request-scoped Effect environments
- [ ] **Phase 3: Devtools** - Implement @sleekstack/devtools with graph visualization and lifecycle tracing

---

## Phase Details

### Phase 1: Core Runtime

**Goal**: Developers can define modules with typed dependency contracts and resolve Effect services inside React trees using `module()`, `LayerProvider`, and `useService()` — with deterministic cleanup and clear errors on misconfiguration.

**Depends on**: Nothing (first phase — rewrites existing prototype from scratch)

**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REACT-06, REACT-07, REACT-08

**Success Criteria** (what must be TRUE):

  1. A developer can call `module({ name, layers, imports, exports })` and the returned Module compiles with correct TypeScript types, with unexported Tags absent from the public surface
  2. Defining two modules that mutually import each other throws synchronously at `module()` call time with a message showing the full cycle (e.g. `AuthModule → UserModule → AuthModule`)
  3. A component wrapped in `<LayerProvider provide={[SomeModule]}>` can call `useService(Tag)` and receive the resolved service; on first mount the component suspends briefly then renders with the service available
  4. A nested `LayerProvider` can shadow a transitive dependency from a parent module by placing a replacement Layer earlier in its own `provide` array — no separate overrides prop needed
  5. Calling `useService(Tag)` with no ancestor `LayerProvider` providing that Tag throws an error that names the missing service and tells the developer which component needs a LayerProvider above it
  6. When a `LayerProvider` unmounts, all services it acquired are finalized in reverse acquisition order with no resource leaks observable in tests

**Plans**: 2/4 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Test + build infrastructure and failing test scaffolds (Nyquist Wave 0)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — @sleekstack/core: module() + DFS cycle detection + type surface

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — @sleekstack/react: LayerProvider + useService + Suspense cache (single scope)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-04-PLAN.md — Nested providers + shadowing + runnable playground demo

**UI hint**: yes

---

### Phase 2: Next.js Integration

**Goal**: Developers can configure a global server-side Effect runtime once and wrap Next.js Server Actions and data fetches in per-request Effect scopes using `configureRuntime()`, `action()`, and `query()`.

**Depends on**: Phase 1

**Requirements**: NEXT-01, NEXT-02, NEXT-03, NEXT-04

**Success Criteria** (what must be TRUE):

  1. Calling `configureRuntime({ provide: [...] })` in `instrumentation.ts` registers a root layer that is shared across all server-side requests without re-initializing between requests
  2. A Next.js Server Action wrapped with `action(function* () { const db = yield* Database })` receives the global runtime's services and executes in an isolated per-request scope that finalizes after the action completes
  3. A data fetch wrapped with `query(function* () { ... })` executes in a per-request scope; concurrent requests do not share state between their scopes
  4. Passing `action({ provide: [MockDbLayer] }, factory)` shadows the global `DatabaseLayer` for that specific action only — no other actions are affected

**Plans**: TBD

---

### Phase 3: Devtools

**Goal**: Developers can inspect the live Effect service graph, trace dependency relationships, and observe Layer lifecycle events through a visual devtools interface — making invisible runtime behavior observable.

**Depends on**: Phase 1, Phase 2

**Requirements**: *(scope defined at planning time — no formal REQ-IDs yet; currently tracked as v2 in REQUIREMENTS.md)*

**Success Criteria** (what must be TRUE):

  1. A developer can open the devtools panel and see a graph of all active `LayerProvider` scopes and their provided Tags at runtime
  2. Clicking a node in the graph shows the dependency chain for that Tag — which Module introduced it and which other Tags it depends on
  3. The devtools display a timeline of Layer acquisition and finalization events, making Suspense waterfalls and cleanup order visible
  4. Shadowing relationships are visually distinguished — a shadowed Tag shows both the original provider and the override

**Plans**: TBD

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Runtime | 2/4 | In Progress|  |
| 2. Next.js Integration | 0/1 | Not started | - |
| 3. Devtools | 0/1 | Not started | - |
