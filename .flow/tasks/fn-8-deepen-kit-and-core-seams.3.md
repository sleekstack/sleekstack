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
Core gained walkProvide, a traversal-only walk that visits each module once, skips cycles and unresolvable import thunks, and does no validation. kit validateProvide is now just the DuplicateTag rule on top of it. Tests cover a shared fixture (kit walk vs core snapshot), DuplicateTag winning over AmbiguousProvider, a cycle that passes at definition time and fails at invocation, and a lazy import.

Drift: walkProvide is tagged @internal, and TypeDoc drops @internal exports, so apps/docs/test/api-coverage.test.ts now skips @internal exports the same way.

stage: impl-review - ran (codex gpt-6-astra: NEEDS_WORK -> SHIP)
## Evidence
- Commits: 1a47c890ef73c23d4932838eb966abb8ef8e0be3, 0da642db8d788a5780353d28587da7f9dba8286a
- Tests: pnpm typecheck && pnpm test --force, pnpm --filter docs build && pnpm --filter docs test
- PRs: