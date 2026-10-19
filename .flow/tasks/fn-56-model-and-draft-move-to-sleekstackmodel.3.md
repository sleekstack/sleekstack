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
The analyzer recognizes `useDraft` by its declaration in `@sleekstack/model` (`model/draft#useDraft`, through a small `modelCalleeOf` in components.ts; extract.ts is untouched, so it cannot conflict with fn-55.4). `checkSlot`, `ConditionalSlot` and missing-store behavior are unchanged. slotHooks.test.ts now scans every `packages/model/src/*.ts` as well as ui's reactive.ts; with the model check removed it fails (shown once: 7 analyzed vs 8 runtime). In the ui-slots fixture, `useDraft` and `DraftSpec` now come from `@sleekstack/model` (tsconfig paths for model and ui/internal). A same-named `useDraft` from `./other/draft`, called conditionally, is not reported, and the exact-list components test proves it. Fixture line numbers shifted by 2 because of the added imports; the `@error` markers move with their calls.

baseline: red (pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack; slotHooks.test.ts + ui-slots failed pre-edit, inherited from .2 and fixed by this task)
Verify: same command green (7/7 tasks); fixture graph check identical before/after; prettier clean; pnpm-lock.yaml untouched.

Tier: implementer opus at medium
stage: impl-review - failed(codex fan-out --base master: all 3 draws produced no output after ~31 min; killed this dispatch's codex exec processes per conductor rule; flowctl recorded nonzero_exit on all draws = refunded transport failure; no verdict)
## Evidence
- Commits: 77eae9555b2c02208c54a0695a6e5e63adcb2861
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack, fixture graph check (kit-app, effect-app): output identical before and after, npx prettier --check (changed files)
- PRs: