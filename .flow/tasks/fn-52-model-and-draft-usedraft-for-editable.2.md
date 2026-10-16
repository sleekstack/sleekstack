---
satisfies: [R6, R10, R12]
---
# fn-52-model-and-draft-usedraft-for-editable.2 Docs, ADR 0038, CONTEXT terms and size budget

## Description
CONTEXT.md terms Model, Draft Spec and Draft (credit ramcinpay-front and EmberData); docs/adr/0038-model-and-draft.md (check the next free number) with README row; README rows for core and ui; a short docs-site page (a Model, a Draft and a Form Action using toDto()); run the showcase size test and update ADR 0022 measured columns if they move. **Touches:** CONTEXT.md, docs/adr/**, packages/core/README.md, packages/ui/README.md, apps/docs/**

## Acceptance
- R10 (size budget), R12 hold
- pnpm turbo run test typecheck --filter=docs --filter=showcase green

## Done summary
Documented Model and Draft. CONTEXT.md has a new "Model and Draft concepts" section with the terms Model, Draft Spec and Draft, crediting ramcinpay-front and EmberData. Also added: `docs/adr/0038-model-and-draft.md` with its index row, rows for `ModelSpec`/`DraftSpec` in the core README and for `useDraft`/`Draft` in the ui README, and the docs page `apps/docs/content/docs/models.mdx` (in `meta.json` after `forms`). The page includes `apps/docs/snippets/models/profile.tsx`, a typechecked snippet with a Model (`fromDto` with ctx), a Draft Spec (Effect `toDto` that needs an `Ids` Service, `toModel`), and a component whose form action yields `draft.toDto()`. The docs cover the limits from task .1: `useDraft(Spec, undefined)` for a spec with no source, `preview`/`changes` only in the type when the spec has `toModel`/`diff`, the `field()` boundary and getter shadowing, and a fresh class instance re-seeding a pristine Draft on every run.

Size budget (R10): the showcase size test passes. Since the last ADR 0022 measurement the numbers moved slightly from fn-52's ui changes (mount 198,571 B gzip, hydrate 220,129 B, lazy 201,093 B, resume unchanged), so the ADR 0022 measured columns were updated. All are within the limits, and the review fix did not change them. The ui README's stale "about 193 kB" now reads "about 199 kB".

Review fixes (Codex fan-out, base master): (1) the snippet's `toModel` used `Number(d.age) || p.age`, which previewed the saved age for a valid "0"; it now tests the shared `wholeNumber` pattern. (2) `useDraft` treated another instance of a spec class as "no swap" because `sameSpec` compared only the five contract callbacks, which instances share through the prototype. `reactive.ts` now compares spec and source with one `same` helper (plain objects and arrays by structure, functions by identity, other objects by identity or `Equal`). Regression test: "R8: another instance of a spec class is a swap, though it shares its methods" in `packages/ui/src/__tests__/draft.test.ts`, run red before the fix. The useDraft doc comment, docs page and ADR 0038 describe the new rule.

Gate note: the first two full verify runs hit showcase timeouts under machine load, with different tests failing each time. Showcase passed alone, and the final run at HEAD 134be72 was fully green (13/13).

Follow-up (not built): none.

Tier: implementer opus at medium

stage: impl-review - ran [fan-out round 1 NEEDS_WORK (3 draws, 2 findings)..re-review round 2 SHIP]
## Evidence
- Commits: 17126d79def717b6f5aae96ce611c4a4e29b1cd3, 134be72c22b3c34b2c6d1ca658400a45647829ac
- Tests: pnpm turbo run test typecheck --filter=docs --filter=showcase --filter=@sleekstack/ui..., pnpm exec prettier --check apps/docs/snippets/models/profile.tsx packages/ui/src/reactive.ts packages/ui/src/__tests__/draft.test.ts
- PRs: