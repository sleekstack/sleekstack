---
satisfies: [R4]
---
# fn-56-model-and-draft-move-to-sleekstackmodel.3 analyzer: recognize slot hooks from @sleekstack/model, extend the sync test

## Description
The analyzer finds slot hooks by where they are defined (`ui/reactive#...`). `useDraft` now lives in another package, so it must be recognized there, and the test that keeps the analyzer's list equal to the real slot hooks must cover external ones.

**Size:** S
**Files:** packages/analyze/src/components.ts, packages/analyze/src/__tests__/slotHooks.test.ts, packages/analyze/src/__tests__/fixtures/ui-slots/ (app.ts, tsconfig.json path for the new package)
**Touches:** [packages/analyze/src/**]

### Approach
- Replace the `ui/reactive#useDraft` check with the new package's declaration id; keep the `checkSlot` path and the `ConditionalSlot` and missing-store behavior identical.
- Extend `slotHooks.test.ts` to scan `packages/model` the way it scans ui's reactive module, so a new slot hook that is not analyzed fails the test.
- Fixture: keep the existing conditional-use markers; add an unrelated function named `useDraft` from another module that must not be reported.
- Equivalence pin: fixture graph check before and after identical; all other analyzer fixtures unchanged.

### Investigation targets
**Required**:
- `packages/analyze/src/components.ts` (the `checkSlot` list in `visit`, `calleeOf`, `libId`)
- `packages/analyze/src/__tests__/slotHooks.test.ts`
- `packages/analyze/src/__tests__/fixtures/ui-slots/app.ts`, `tsconfig.json`

## Acceptance
- [ ] A conditionally called `useDraft` from `@sleekstack/model` reports `ConditionalSlot` at the same line as before; an unconditional call reports nothing
- [ ] A same-named function from another module is not reported
- [ ] `slotHooks.test.ts` fails if a slot hook in `packages/model` is missing from the analyzer list (shown by removing it once)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` and the fixture graph check are green and identical

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
