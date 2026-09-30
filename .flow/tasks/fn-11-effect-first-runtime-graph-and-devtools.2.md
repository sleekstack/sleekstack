---
satisfies: [R1]
---
# fn-11-effect-first-runtime-graph-and-devtools.2 kit: rebase action/query/defineEffect/defineQuery/effect on runEffect; delete next action/query

## Description
Move kit's Next entry points off `@sleekstack/next`'s `action()`/`query()` onto `runEffect`, then delete next's `action.ts`.

**Size:** M
**Files:** packages/kit/src/next/action.ts, packages/kit/src/next/runtime.ts, packages/next/src/action.ts (delete), packages/next/src/index.ts, packages/next/src/__tests__/next.test.ts, packages/kit/src/__tests__/next.test.ts
**Touches:** [packages/kit/src/next/**, packages/next/src/**, packages/kit/src/__tests__/next*]

### Approach
- Per-call `overrides` built from the caller's modules without flattening them (memory: do-not-flatten-modules-for-next).
- Keep `ActionResult`, `fail`, kit `OperationOptions`, kit `RuntimeConfig` public shapes unchanged.
- Keep the ADR 0009 internal exit hook path working; move next's action tests that still apply into runtime/kit tests.

### Investigation targets
**Required**:
- packages/kit/src/next/action.ts:11,155-181
- packages/kit/src/next/runtime.ts:9,41
- packages/next/src/action.ts
- packages/kit/src/__tests__/next.test.ts, next-types.test-d.ts

## Acceptance
- [ ] `@sleekstack/next` exports no action/query/Operation/OperationOptions
- [ ] Kit next tests, type tests and showcase-kit smoke/parity pass unchanged
- [ ] Exit-hook test still fires for typed failures

## Done summary
Kit action/query/defineEffect/defineQuery/effect now run on @sleekstack/next runEffect (modules passed unflattened through an internal provide option); next action/query/Operation/OperationOptions and the onExit hook removed. Codex: round 1 NEEDS_WORK (registration race with synchronous reconfigure), fixed with a regression test; round 2 SHIP.
Left for task 7: apps/docs/snippets/effect/next.ts still imports next's action/query; ADR 0009 (exit hook) is superseded by this change.
stage: plan-sync - skipped(config: no drift found)
## Evidence
- Commits: d69f514, d69f514
- Tests: pnpm --filter @sleekstack/next test (17 passed), pnpm --filter @sleekstack/kit test (89 passed), typecheck next, kit, showcase, showcase-kit
- PRs: