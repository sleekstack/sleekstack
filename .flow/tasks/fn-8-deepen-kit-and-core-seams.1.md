---
satisfies: [R1, R2]
---
# fn-8-deepen-kit-and-core-seams.1 Single Tag resolution + normalize as the only error seam

## Description
kit next lowering uses core `resolveTagEffect` instead of its inline serviceOption + privateDependencyOf (packages/kit/src/next/action.ts:73-80). `normalize` (packages/kit/src/errors.ts) absorbs the FiberFailure and next-rejection-cause unwraps; delete `toKit` (packages/kit/src/react/hooks.ts:24) and the inline unwrap in next/action.ts:94-97. Route the AtomStore's missing/private conversion (`atomStoreFor.wrapBuild`, packages/core/src/atom/scope.ts:45-50) through the same shared core error constructors (spec Decisions: canonical shape and message). Update only the tests that assert the old useService plain-Error message or kit `Unknown` code. Add a core table test for resolution and a kit table test for `normalize` envelopes.

Touches: packages/kit/src/next/action.ts, packages/kit/src/errors.ts, packages/kit/src/react/hooks.ts, packages/kit/src/react/atoms.ts, packages/kit/src/__tests__/errors.test.ts, packages/core/src/scope.ts, packages/core/src/errors.ts, packages/core/src/atom/scope.ts, packages/core/src/__tests__/resolve.test.ts, packages/react/src/__tests__/useService.test.tsx

## Acceptance
- [ ] No `privateDependencyOf` call outside packages/core, and no `FiberFailureCauseId` outside kit errors.ts (grep).
- [ ] A core table test covers public/private/missing/shadowed resolution; a kit table test covers `normalize` for Cause, FiberFailure, next-wrapped rejection, tagged graph error, LayerFailure and CleanupFailure.
- [ ] Every boundary (useService, AtomStore, kit next, kit atoms) gives the canonical MissingDependency/PrivateDependency code, details and message, asserted by one shared table.
- [ ] All other existing tests pass (pnpm test --force).


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
