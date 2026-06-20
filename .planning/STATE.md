---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: active
stopped_at: Phase 1 complete — verified 2026-06-20
last_updated: "2026-06-20T10:22:00.000Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 33
---

# Project State

## Project Reference

**Core value**: `useService(Tag)` resolves a service from the nearest `LayerProvider`, suspending on first acquisition and returning synchronously from cache thereafter — with deterministic cleanup on unmount.

**Current focus**: Phase 2 — Next.js Integration (`@sleekstack/next`)

**Repository structure**: pnpm workspaces monorepo — `packages/core`, `packages/react`, `packages/next` (planned), `apps/playground`

---

## Current Position

**Active phase**: Phase 2 — Next.js Integration
**Active plan**: (not started)
**Phase status**: Phase 1 complete — Phase 2 not started

```
Phase 1 [##########] 100% Core Runtime (4/4 plans, verified)
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

### Phase 1 open issues (post-phase improvements for Phase 2)

- **CR-01**: `disposeRuntime` silent async-dispose failure — `runSyncExit` returns Exit.die instead of throwing on async boundary; fallback `dispose?.()` unreachable. Fix: inspect Exit tag, call `void runtime.dispose()` on failure.
- **CR-02**: `package.json` `types` field points to `src/index.ts` (does not exist); actual barrel is `src/index.tsx`. Fix: one-line change.
- **CR-03**: `useService` loops infinitely when a service resolves to `undefined` — value-presence check `!== undefined` is semantically wrong. Fix: discriminated `{ status }` union for CacheEntry.
- **CR-04**: Nested `LayerProvider` crashes when parent has an async Layer — `runSync(Effect.context())` throws AsyncFiberException. Fix: guard with `cachedRuntime` check or throw a suspense promise.

### Deferred items

- `@sleekstack/testing` — deferred; shadowing covers 80% of testing needs
- `@sleekstack/query` — client-side Suspense-native query/cache
- `@sleekstack/rpc` — end-to-end typed RPC
- Airtight type-level module enforcement — TypeScript inference limits (recursive types, slow IDE)

### Blockers

*(none)*

---

## Session Continuity

**Last session:** 2026-06-20T10:22:00.000Z
**Stopped at:** Phase 1 verified — all 12 requirements pass, 32 tests green, 0 type errors
**Resume file:** n/a — Phase 2 not planned yet

**Next action**: Plan Phase 2 (Next.js Integration) or address Phase 1 open issues (CR-01..CR-04) first.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 01 P01 | 6 minutes | 2 tasks | 14 files |
| Phase 01 P02 | 2 minutes | 2 tasks | 3 files |
| Phase 01 P03 | 4 minutes | 3 tasks | 5 files |
| Phase 01 P04 | 7 minutes | 3 tasks | 3 files |

## Decisions

- [Phase 01 P01]: React test imports use ../index barrel to ensure per-test failures rather than file-level import errors in RED state
- [Phase 01 P01]: REACT-07 tests verify negative constraints about Runtime/Scope/Fiber not being exported — invariants that hold in both old and new implementations
- [Phase 01 P02]: detectCycles uses {name, imports} shape; module() maps via toDetectShape() to keep cycle.ts independent of Module type
- [Phase 01 P02]: name validation uses typeof guard + trim() to reject non-string/empty inputs; never used as object key (prototype-pollution prevention)
- [Phase 01 P03]: Module detection in assembleLayer uses duck-typing (_name + _layers + _imports) rather than instanceof — keeps react package decoupled from core at runtime
- [Phase 01 P03]: Layer.empty and ManagedRuntime.make require type casts (Layer<never,never,never> vs Layer<any,any,any>; ManagedRuntime<any,any> vs ManagedRuntime<any,never>) — semantically correct, TypeScript formality
- [Phase 01 P04]: React 19 runs useEffect cleanups parent-before-child; inner-before-outer finalization achieved via registerChildDispose mechanism (parent calls registered child disposals LIFO before its own dispose)
