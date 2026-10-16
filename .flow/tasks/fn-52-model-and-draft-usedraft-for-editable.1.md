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
Added `ModelSpec` and `DraftSpec` as type-only exports in `@sleekstack/core` (`packages/core/src/model.ts`), and the slot hook `useDraft(spec, src)` plus the `Draft` type in `@sleekstack/ui` (`packages/ui/src/reactive.ts`). The analyzer's `checkSlot` list includes `useDraft`, and the `ui-slots` fixture has a matching case. Tests are in `packages/ui/src/__tests__/draft.test.ts` (11 cases covering R2-R9) and `draft.test-d.ts` (R1 Type = Encoded, field keys, preview/changes presence, E/R flowing into a Form Action handler).

How it works: `src` is a value or an atom. The Draft state is one writable atom that remembers its own previous value, so a source change re-seeds the Draft only while it is pristine (checked with `Schema.equivalence`). `errors`, `valid`, `dirty`, `preview` and `changes` are derived atoms computed only when read. `toDto()` decodes with the schema (`errors: 'all'`) and then runs `spec.toDto`.

Deviations from the spec text:
- `useDraft` with a `void` source still needs a second argument (`useDraft(Spec, undefined)`), the same as ramcinpay's `useDraftForm`.
- `preview` and `changes` always exist at runtime and read `undefined` while the current spec lacks `toModel` / `diff`. In the types they appear only when every member of the spec type has the method.

Review: the Codex impl-review stopped after 3/4 rounds with ESCALATE (`same-not-fixed-lineage`). Round 1 found two issues, which were fixed: optional members depended on the first spec, and array Drafts were spread into plain objects. Rounds 2 and 3 each raised a narrower case of the same `field()` finding, which flowctl counted as one finding never fixed:
- Round 2: primitive Drafts. Fixed in 27aff6c, where `FieldKey` allows array indexes and a record's non-function keys only.
- Round 3: class instances. Fixed in 08a1978, where a field write copies the Draft with its prototype.

08a1978 has not been reviewed: flowctl reserved no further round.

Follow-up for docs (task .2): `field()` is for record and array Drafts. Writing a key that is a getter-only accessor shadows it with an own data property.

stage: impl-review - failed(ESCALATE same-not-fixed-lineage after 3/4 rounds; last verdict NEEDS_WORK on field() class-instance writes, fixed in 08a1978 but not reviewed)

Later fix (e861f38): value `src` and `spec` compared structurally so fresh-but-equal copies never write or re-seed; a real change no longer re-runs its own component (renderer skips that notification). Regression test: async generator, inline source/spec copies, unrelated-atom reruns. Codex impl-review SHIP on e861f38 after a review reset (earlier rounds escalated on field() variants).
## Evidence
- Commits: e861f389a8d315c1aa79b2b34d5d654003e4f3c8
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/core... --filter=...@sleekstack/core --filter=@sleekstack/analyze --filter=sleekstack
- PRs: