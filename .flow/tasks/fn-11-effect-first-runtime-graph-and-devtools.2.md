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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
