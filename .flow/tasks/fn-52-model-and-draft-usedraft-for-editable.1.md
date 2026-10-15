---
satisfies: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R12]
---
# fn-52-model-and-draft-usedraft-for-editable.1 useDraft in @sleekstack/ui with analyzer slot-hook entry

## Description
Implement useDraft(model) as a slot hook in packages/ui/src/reactive.ts following useDerivedAtom/useDeferredAtom (takeSlot, per-instance atoms released on dispose); export Draft and useDraft from index.ts; add to the analyzer checkSlot list (packages/analyze/src/components.ts) and its ui-slots fixture; slotHooks.test.ts must stay in sync. **Touches:** packages/ui/src/**, packages/analyze/src/**

## Acceptance
- R1-R7, R9 (hook, analyzer, tests) hold
- pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
