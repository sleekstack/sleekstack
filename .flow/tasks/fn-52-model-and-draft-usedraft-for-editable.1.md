---
satisfies: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11]
---
# fn-52-model-and-draft-usedraft-for-editable.1 ModelSpec/DraftSpec types and useDraft with analyzer slot-hook entry

## Description
Types ModelSpec and DraftSpec (types only) in @sleekstack/core (R1; no new runtime export), and the slot hook useDraft(spec, src) in @sleekstack/ui (R2-R5, R8) following useDerivedAtom/useDeferredAtom/useOptimistic in packages/ui/src/reactive.ts (takeSlot, per-instance atoms released with the instance Scope; compose existing atoms, Effect Schema and Schema.equivalence; src may be a value or an Atom). Composition tests (R9): a Form Action generator handler yielding draft.toDto() into useAction's Result, useFormStatus, and toModel as useOptimistic's apply. Analyzer checkSlot entry + ui-slots fixture; slotHooks.test.ts in sync; exportNames test green. Port semantics from ~/WebstormProjects/ramcinpay-front (read-only: libs/shared/utils/src/model.ts, draft.ts, libs/shared/hooks/src/useDraftForm.ts, docs/agents/models-fromdto-todto.md). **Touches:** packages/core/src/**, packages/ui/src/**, packages/analyze/src/**

## Acceptance
- R1-R11 (types, hook, composition, analyzer, tests, type tests) hold
- pnpm turbo run test typecheck --filter=@sleekstack/core... --filter=@sleekstack/analyze --filter=sleekstack green (ui and dependents included)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
