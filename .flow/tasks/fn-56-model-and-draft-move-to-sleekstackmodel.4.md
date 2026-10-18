---
satisfies: [R5, R6]
---
# fn-56-model-and-draft-move-to-sleekstackmodel.4 showcase, docs, size budget and records for @sleekstack/model

## Description
Point every consumer at the new package and record the move: showcase page and tests, docs snippets and the Models guide, the size budget test, CONTEXT.md, READMEs, AGENTS.md and a new ADR that amends ADR 0038.

**Size:** M
**Files:** apps/showcase/src/pages/model.tsx, apps/showcase/test/model.test.ts and size.test.ts, apps/showcase/README.md, apps/showcase/package.json; apps/docs/snippets/models/*.tsx, apps/docs/content/docs/models.mdx, apps/docs/package.json; CONTEXT.md; AGENTS.md; packages/core/README.md; packages/ui/README.md; docs/adr/0039-*.md and docs/adr/README.md row
**Touches:** [apps/showcase/**, apps/docs/snippets/**, apps/docs/content/docs/models.mdx, apps/docs/package.json, CONTEXT.md, AGENTS.md, packages/*/README.md, docs/adr/**, pnpm-lock.yaml]

### Approach
- Change imports to `@sleekstack/model`; add the dependency to showcase and docs; add the source alias for `@sleekstack/model` in the showcase size test.
- Size test: assert ui's eager entry did not grow and measure `model` separately (ADR 0022 method).
- ADR: records the move, why the types and the hook travel together, and the `ui/internal` slot-hook extension point; ADR 0038 gets a status line pointing to it.
- CONTEXT: Model, Draft Spec and Draft entries name `@sleekstack/model`; AGENTS.md verify table gets a model row; READMEs list the package and drop the Draft entries from core and ui.
- Check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries.

### Investigation targets
**Required**:
- `apps/showcase/src/pages/model.tsx`, `apps/showcase/test/model.test.ts`, `apps/showcase/test/size.test.ts`
- `apps/docs/snippets/models/profile.tsx`, `apps/docs/content/docs/models.mdx`
- `CONTEXT.md` (Model and Draft concepts), `AGENTS.md`, `docs/adr/README.md`, `docs/adr/0038-model-and-draft.md`
**Optional**:
- `docs/adr/0022-ui-size-budget-and-publish-gate.md`

## Acceptance
- [ ] Showcase demo and its tests pass with only imports changed; docs snippets typecheck against the new package
- [ ] Size test shows ui's entry not larger and `model` measured on its own
- [ ] New ADR merged into the index and linked from ADR 0038; CONTEXT, READMEs and AGENTS.md name `@sleekstack/model`
- [ ] `pnpm turbo run test typecheck --filter=showcase --filter=docs` and the root `pnpm test` are green

## Done summary
Showcase (model page, size entry, architecture/fixtures tests) and the docs Models guide and snippets now import from `@sleekstack/model`, which both apps depend on. The size test aliases model source, adds a `mount with a Draft` entry (220,001 B gzip, limit 231,000), checks that a mount-only bundle has no Draft code (shown red when the entry re-exported useDraft), and caps ui's entries at their sizes measured on master before the move (mount 198,667 -> 198,602; hydrate 220,221 -> 220,145; lazy 201,154 -> 201,083 B gzip). ADR 0040 records the move and the `ui/internal` slot-hook extension point; ADR 0038 status and the ADR index point to it, and the ADR 0022 table is remeasured. CONTEXT (Model, Draft Spec, Draft), the AGENTS.md verify table (model row) and the showcase README name the package. The core and ui READMEs had already been updated in .2.

Follow-up (outside Touches, not edited): root `README.md:71` still says ui has "forms and Drafts" and has no `@sleekstack/model` row (two Codex draws flagged it; dropped from the merge as out of Touches). Also outside Touches: `apps/docs/content/docs/ui.mdx:35` and `errors.mdx:48` list `useDraft` among slot hooks without naming its package. They are still accurate.

baseline: red (pnpm turbo run test typecheck --filter=showcase --filter=docs; showcase typecheck failed on old core/ui imports, inherited from .2 and fixed here)
Verify: pnpm turbo run test typecheck --filter=showcase --filter=docs green (11/11); root pnpm test green (26/26); pnpm-lock.yaml has no apps/sleek-codes entries; apps/bench/src/scenarios.ts untouched.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out --base master: 3 draws NEEDS_WORK; kept size no-growth bound (fixed in 9837c9e), dropped ADR 0022 figures (reviewer sandbox build differs; table is from the test's own output) and root README (outside Touches); single re-review SHIP)
## Evidence
- Commits: 371e16fb72ef19119fc748ca8d38214b9b7ea8e1, 9837c9ea08d29e25ac77c5619e85e2cec4aecf99
- Tests: pnpm turbo run test typecheck --filter=showcase --filter=docs, pnpm test
- PRs: