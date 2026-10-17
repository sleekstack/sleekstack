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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
