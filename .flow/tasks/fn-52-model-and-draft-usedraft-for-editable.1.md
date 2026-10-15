---
satisfies: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10]
---
# fn-52-model-and-draft-usedraft-for-editable.1 ModelSpec/DraftSpec types and useDraft with analyzer slot-hook entry

## Description
Add the types ModelSpec and DraftSpec (R1) and the slot hook useDraft(spec, src) (R2-R5, R8) to @sleekstack/ui: packages/ui/src/reactive.ts following useDerivedAtom/useDeferredAtom/useOptimistic (takeSlot, per-instance atoms released on dispose; compose existing atom primitives and Effect Schema, no core changes). Read the ramcinpay-front reference first (~/WebstormProjects/ramcinpay-front: libs/shared/utils/src/model.ts, draft.ts, libs/shared/hooks/src/useDraftForm.ts, docs/agents/models-fromdto-todto.md; read only). Export from index.ts; analyzer checkSlot entry (packages/analyze/src/components.ts) plus the ui-slots fixture; slotHooks.test.ts in sync. **Touches:** packages/ui/src/**, packages/analyze/src/**

## Acceptance
- R1-R5, R7, R8, R10 (hook, analyzer, tests, type tests) hold
- pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
