---
satisfies: [R9, R11]
---
# fn-1-sleekstack-effect-native-di-modules-and.8 React adapter: nested providers over async parents, inner-before-outer finalization, nested shadowing

## Description
Nesting semantics (R9) on top of the provider.

**Size:** M
**Files:** `packages/react/src/LayerProvider.tsx`, `packages/react/src/__tests__/nesting.test.tsx`, `apps/playground/src/App.tsx`, `apps/playground/src/services.ts`
**Touches:** [packages/react/src/**, apps/playground/**]

## Approach
- Child provider builds a child scope from the parent scope (core .4), suspending while the parent is still acquiring; no synchronous parent-context extraction.
- Parent close waits for child closes (inner before outer).
- Nested `provide` shadows parent entries for the subtree only.
- Nested provider entries are built in the child scope via core's child-boundary API (lifetime coerced to component).
- Update playground to a nested async example; split Tags into a Tag-only module separate from service definitions, with one server-only implementation module carrying a marker string.
- Bundle check: build the playground and assert the marker string is absent from the client output (R11).

## Investigation targets
**Required:**
- `packages/react/src/LayerProvider.tsx:145-184` — prototype runSync limitation (do not reuse)
- `packages/react/src/__tests__/nesting.test.tsx` — cases to make pass

## Acceptance
- [ ] Nested provider over async parent resolves (StrictMode)
- [ ] Inner finalizers run before outer on unmount
- [ ] Nested shadowing limited to subtree
- [ ] Playground runs
- [ ] Playground build output does not contain the server-only marker; check runs in `pnpm test`

## Done summary
Implemented React adapter nesting semantics (R9): child LayerProvider builds a child scope off the parent scope, suspending while the parent is still async-acquiring (no synchronous parent-context extraction); inner finalizers run before outer on unmount; nested `provide` shadows parent entries for the subtree only. Playground updated to a genuinely async nested-provider demo (server module acquires via `Effect.sleep`) with Tags split from the server-only implementation module carrying a marker string; `apps/playground/src/__tests__/bundle.test.ts` (R11) now walks the full chunk graph (static + dynamic imports) reachable from the client entry and asserts the marker is absent.

Resumed a stalled worker: prior commits 38bdf84 (feature) and deedd99 (fix for round-1 impl-review findings: genuine async parent acquisition + full chunk-graph bundle check) were already in place. This session verified the round-2 codex impl-review receipt (/tmp/impl-review-receipt-fn-1-sleekstack-effect-native-di-modules-and.8.json) already recorded SHIP at head_sha deedd99 (matching current HEAD) with 0 introduced / 0 pre-existing findings, ran the full verification suite (pnpm typecheck, pnpm test - 39 core + 30 react + 12 next + 1 playground bundle test, all green), and completed the task.

stage: impl-review - ran [2026-09-27T14:10:43Z..2026-09-27T14:15:34Z] verdict SHIP (round 2, codex/gpt-5.6-sol, receipt /tmp/impl-review-receipt-fn-1-sleekstack-effect-native-di-modules-and.8.json; verified this session against current HEAD deedd99, not re-invoked)
## Evidence
- Commits: 38bdf84608dfe3daa129a240dc12fbc9625a11d7, deedd99ea7dcb6c1d85adc61e0e6e2555c99f208
- Tests: pnpm typecheck, pnpm test
- PRs: