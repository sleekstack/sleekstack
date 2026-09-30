---
satisfies: [R10]
---
# fn-12-effect-native-query-layer.9 Devtools: client-side query event buffer and Queries tab

Touches: [packages/devtools/**, packages/query/src/events.ts, apps/showcase/src/__tests__/bundle.test.ts]

## Description
Query cache visibility in the devtools panel (spec: Devtools; edge case: client-side buffer).

**Size:** M
**Files:** packages/query/src/events.ts, packages/devtools/src/*, apps/showcase/src/__tests__/bundle.test.ts
**Touches:** [packages/devtools/**, packages/query/src/events.ts, apps/showcase/src/__tests__/bundle.test.ts]

### Approach
- The server dev buffer (`packages/next/src/runtime.ts:43-74`, 200 cap) is server-only; add a client-side ring buffer with per-kind caps so focus/interval refetches cannot evict other events, gated on the dev flag so nothing ships in production.
- Emit entry key, state, observers, updatedAt, gc timer; a Queries tab in the panel (`packages/devtools/src/index.tsx`) with an empty state.
- BLOCKED until fn-11.6 (the devtools package) is done: run `flowctl show fn-11-effect-first-runtime-graph-and-devtools.6` first and stop with NEEDS_HUMAN if it is not `done`; extend the bundle test to assert query devtools code is absent from production chunks.

### Investigation targets
**Required**:
- `packages/devtools/src/index.tsx`
- `packages/next/src/devtools.ts`
- `apps/showcase/src/__tests__/bundle.test.ts`

## Acceptance
- [ ] Panel lists query entries with state and updatedAt in dev; empty state when the buffer is empty
- [ ] Per-kind caps prevent refetch chatter from evicting other events
- [ ] Production client chunks contain no query devtools code (bundle test)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
