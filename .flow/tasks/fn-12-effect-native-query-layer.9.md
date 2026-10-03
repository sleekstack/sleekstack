---
satisfies: [R10]
---
# fn-12-effect-native-query-layer.9 Devtools: client-side query event buffer and Queries tab

Touches: [packages/query/src/index.ts, packages/devtools/**, packages/query/src/events.ts, packages/query/src/query.ts, apps/showcase/src/__tests__/bundle.test.ts]

## Description
Query cache visibility in the devtools panel (spec: Devtools; edge case: client-side buffer).

**Size:** M
**Files:** packages/query/src/events.ts, packages/devtools/src/*, apps/showcase/src/__tests__/bundle.test.ts
**Touches:** [packages/query/src/index.ts, packages/devtools/**, packages/query/src/events.ts, packages/query/src/query.ts, apps/showcase/src/__tests__/bundle.test.ts]

### Approach
- The server dev buffer (`packages/next/src/runtime.ts:43-74`, 200 cap) is server-only; add a client-side ring buffer with per-kind caps so focus/interval refetches cannot evict other events, gated on the dev flag so nothing ships in production.
- Emit entry key, state, observers, updatedAt, gc timer; a Queries tab in the panel (`packages/devtools/src/index.tsx`) with an empty state.
<!-- Updated by plan-sync: fn-12.7 kit hooks are `useQuery`, `useMutation`, `useQueryClient`, `QueryProvider` in @sleekstack/kit/react; the buffer lives in @sleekstack/query so both kit and effect surfaces feed it -->
- BLOCKED until fn-11.6 (the devtools package) is done: run `flowctl show fn-11-effect-first-runtime-graph-and-devtools.6` first and stop with NEEDS_HUMAN if it is not `done`; extend the bundle test to assert query devtools code is absent from production chunks.

<!-- Updated by plan-sync: fn-12.2 exports modules via packages/query/src/index.ts; add the events export there -->

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
Added a client-side query event buffer (`QueryEvents` in @sleekstack/query: per-kind rings of 50, recorded by the `Query.make` lifecycle on added/fetching/success/failure/removed, no-op in production via a foldable `process.env.NODE_ENV` guard) and a Queries tab in @sleekstack/devtools listing key, state, observers, updatedAt and gc timer with an empty state. The showcase bundle test asserts `QUERY_DEVTOOLS_MARKER` is absent from client chunks. Tests: packages/query/src/__tests__/events.test.ts (per-kind caps, production no-op, lifecycle events between polls), packages/devtools/src/__tests__/devtools.test.tsx (entries, empty state, removal on unmount). Note: @sleekstack/devtools now depends on @sleekstack/query (pnpm-lock.yaml updated).

stage: impl-review - ran (codex: round 1 NEEDS_WORK 3 findings, round 2 SHIP)
Tier: implementer
## Evidence
- Commits: d7908f496f01689efe10705d871321f46e455f85, ff7901bdc99fb576aa12b18fd5bb17d29cbf12be, 66dde339c9d248b3a5adbaea267748f5602b65e7, a2090744926ad9dadfe3ee8a1ee36a2b1ad82141
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter @sleekstack/devtools test, pnpm --filter showcase build && pnpm --filter showcase typecheck && pnpm --filter showcase test
- PRs: