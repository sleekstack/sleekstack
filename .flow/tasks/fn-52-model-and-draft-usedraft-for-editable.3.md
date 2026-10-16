---
satisfies: [R13]
---
# fn-52-model-and-draft-usedraft-for-editable.3 Showcase Model/Draft demo

## Description
Add a Model/Draft page to apps/showcase: a Model built with fromDto(dto, ctx), an edit Draft with per-field errors, dirty, reset, a control that changes the source to show pristine re-seed vs dirty keep, a live preview, and a submit through a Form Action using toDto() with its Result; linked from the shell and listed in apps/showcase/README.md; test it; respect the architecture test and size entries; switch the existing task form only if it removes code with no behaviour change. **Touches:** apps/showcase/**

## Acceptance
- R13 holds
- pnpm turbo run test typecheck --filter=showcase green; sleekstack check clean

## Done summary
Added the Model and Draft demo page to the showcase (`apps/showcase/src/pages/model.tsx`), linked from the shell as "Model and Draft" and listed in `apps/showcase/README.md`. The page has a Model built by `ProfileModel.fromDto(dto, countries)`, where ctx is a country index (resolved data). The Draft comes from `useDraft(ProfileDraft, profile)` with an atom source, and the page shows per-field errors, `dirty`, `reset` and a live `preview` (`toModel`). "Someone else saves it" patches the page's server record: a pristine Draft re-seeds and an edited one keeps its edits. Save is a Form Action that yields `draft.toDto()`, which reads the `Viewer` Service. `sleekstack check` reports the action closure as requiring `Viewer, Store`, both provided, so the check is clean. Save also shows the `useAction` Result ("Not saved" on a `ParseError`) and the `useFormStatus` pending state (fieldset disabled, "Saving"). After the save, `draft.reset()` re-seeds from the saved record.

Test: `apps/showcase/test/model.test.ts` runs one flow in both a client mount and SSR + `hydrate`. The flow covers seed, pristine re-seed, edited keep, both field errors, a `ParseError` in the Result, reset, pending, and a save. All text comes from `useAtomValue` re-runs, so the page avoids the known `hydrateMount` atom-bound-text limit. The input values are atoms bound to attributes. The shell test in `test/app.test.ts` lists the new page.

Not done (by the rule in R13): the new-task form stays on `FormData` decoding. It is an uncontrolled form, so `useDraft` would add field setters, value bindings and a reset, which is more code.

Size: the ADR 0022 entries did not change (mount 198,571 B, hydrate 220,129 B, lazy 201,093 B, resume 79,447 B gzip), because the size entries do not import pages. No measured columns were updated, and no package code changed.

Review (Codex, base master): the first-round fan-out returned correctness SHIP, contracts NEEDS_WORK and integration NEEDS_WORK.
- Kept and fixed (6b06758): the age schema accepted any digit string, so a 400-digit age saved `Infinity`. The schema now bounds the age to 0-150 (`isAge`), the preview uses the same check, and the regression test was run red first. The re-review returned SHIP.
- Dropped as outside this task (needs a decision from the conductor or spec owner): the contracts draw found that `field()` on a class-instance Draft copies it with `Object.create(proto)` plus enumerable properties (`packages/ui/src/reactive.ts:939`), which loses `#private` fields and internal slots. This is task .1's code, in the same `field()` lineage as its earlier review rounds. This task forbids package behaviour changes, so it is a follow-up. Either `field()` takes plain records and arrays only, or the limit is documented next to the getter-shadowing note.

Follow-ups (not built):
- the `field()` class-instance private-state limit above.
- `apps/docs/snippets/models/profile.tsx` has the same unbounded `wholeNumber` age pattern, so a 400-digit age converts to `Infinity` in its `toDto`. It is outside this task's Touches.

Tier: implementer opus at medium

stage: impl-review - ran [fan-out round 1 NEEDS_WORK (3 draws, 1 kept finding)..re-review round 2 SHIP]
## Evidence
- Commits: 67e91e382c2d1b99b3ee711218b9128b4519a266, 6b0675842a11ea93dd9ce5445adb4eb7e3e61fce, 8e29e4377d1e6b36208927137c3a1283bd2a4fbd
- Tests: pnpm turbo run test typecheck --filter=showcase --filter=docs, pnpm --filter showcase build, sleekstack check (apps/showcase), baseline: green (pnpm turbo run test typecheck --filter=showcase --filter=docs)
- PRs: