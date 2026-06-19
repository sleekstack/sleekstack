---
project: SleekStack
updated: 2026-06-20
---

# Project State

## Project Reference

**Core value**: `useService(Tag)` resolves a service from the nearest `LayerProvider`, suspending on first acquisition and returning synchronously from cache thereafter — with deterministic cleanup on unmount.

**Current focus**: Phase 1 — Core Runtime (`@sleekstack/core` + `@sleekstack/react`)

**Repository structure**: pnpm workspaces monorepo — `packages/core`, `packages/react`, `packages/next` (planned), `apps/playground`

---

## Current Position

**Active phase**: Phase 1 — Core Runtime
**Active plan**: None (planning not yet started)
**Phase status**: Not started

```
Phase 1 [          ] 0%   Core Runtime
Phase 2 [          ] 0%   Next.js Integration
Phase 3 [          ] 0%   Devtools
```

---

## Architecture Decisions (Locked)

| Decision | Choice | ADR |
|----------|--------|-----|
| Effect coupling | Middle-path: expose Tag/Layer/Effect, hide Runtime/Scope/Fiber | 0001 |
| Module scope isolation | Type-level only — no runtime enforcement | 0002 |
| Override mechanism | Shadowing via `provide` ordering — no separate overrides prop | 0003 |

---

## Accumulated Context

### Key decisions

- Phase 1 rewrites the existing prototype from scratch — the current `packages/core` and `packages/react` are starting points, not the foundation
- `module()` requires a `name` field — devtools need stable identifiers; Tags provide layer names for free
- Next.js client (LayerProvider) and server (action/query) are intentionally separate packages and separate mental models
- Circular import detection fires at `module()` definition time — earliest possible failure point
- `@sleekstack/testing` is explicitly deferred — shadowing via `provide` covers the primary testing use case

### Deferred items

- `@sleekstack/testing` — deferred; shadowing covers 80% of testing needs
- `@sleekstack/query` — client-side Suspense-native query/cache
- `@sleekstack/rpc` — end-to-end typed RPC
- Airtight type-level module enforcement — TypeScript inference limits (recursive types, slow IDE)

### Blockers

*(none)*

---

## Session Continuity

**Next action**: Run `/gsd-plan-phase 1` to create a detailed plan for Phase 1 — Core Runtime.

**Phase 1 scope reminder**: CORE-01 through CORE-04 (module() API) + REACT-01 through REACT-08 (LayerProvider, useService, shadowing, cleanup). Rewrites existing prototype packages.
