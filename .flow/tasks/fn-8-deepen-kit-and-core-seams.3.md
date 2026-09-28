---
satisfies: [R3]
---
# fn-8-deepen-kit-and-core-seams.3 Share core's provide walk with kit validateProvide

## Description
Expose an @internal traversal-only core `walkProvide` (spec Decisions: no validation, skips visited modules, no shadowing/AmbiguousProvider; walkModules may reuse it) and rebuild kit `validateProvide` (packages/kit/src/module.ts:104-127) as the DuplicateTag rule over it. Add a shared fixture test (nested imports, thunks, diamonds, cycles) asserting kit and core reach the same Tags.

Touches: packages/core/src/graph.ts, packages/core/src/index.ts, packages/kit/src/module.ts, packages/kit/src/__tests__/module.test.ts, packages/core/src/__tests__/walk.test.ts

## Acceptance
- [ ] kit module.ts has no hand-written module traversal.
- [ ] The shared fixture test passes; DuplicateTag tests pass unchanged; DuplicateTag wins over AmbiguousProvider for two direct same-key providers; a cyclic module set passes definition-time validation and fails only at invocation, as today.
- [ ] pnpm test --force green.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
