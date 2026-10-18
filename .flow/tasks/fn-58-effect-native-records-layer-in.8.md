---
satisfies: [R8]
---
# fn-58-effect-native-records-layer-in.8 ADR, CONTEXT terms and docs

## Description
Record the decision and document the feature. This supersedes ADR 0038's rejection of relationships and a record store.

**Size:** M
**Files:** docs/adr/README.md, docs/adr/0041-records-layer.md (take the next free number at write time; fn-55 task 7 edits the same files), CONTEXT.md, apps/docs/content/docs/models.mdx, packages/model/README.md, apps/docs/scripts/entry-points.mjs
**Touches:** docs/adr/README.md, docs/adr/0041-records-layer.md, CONTEXT.md, apps/docs/content/docs/models.mdx, packages/model/README.md, apps/docs/scripts/entry-points.mjs

### Approach
- New ADR: records layer in `@sleekstack/model`, the Record, Transformation and Adapter split, the resolved decisions in the spec, and an explicit supersession of the relationships-and-record-store line in ADR 0038's Rejected section. Read that section first for the exact wording; add the index row.
- CONTEXT.md: add terms next to the Model and Draft concepts (record, transformation, adapter, record reference), avoiding `Record` and `Entity`.
- Models guide and the model README: define, find, relationships, commit, the optional `./query` entry, the client-only map, the Store requirement.
- Add `model` to `PACKAGES` in `entry-points.mjs` if the generated API docs should cover it; never hand-edit generated API docs, run `generate:api`.

#- From task 7: the ADR 0022 table already has the measured rows for the new records entry (222,215 B gzip against a 233,000 B limit; the existing Draft entry stays under its unchanged 231,000 B limit); reference them, do not remeasure. Reviewers measuring in their own sandboxes read about 100 to 150 B lower, all budgets pass either way. Task 7 also added a `size/records` rule to the showcase architecture and fixtures tests.

## Investigation targets
**Required**:
- `docs/adr/0038-model-and-draft.md` - the Rejected section
- `docs/adr/0040-model-package.md` - format and the amend wording
- `CONTEXT.md:262-276` - Model and Draft terms
- `apps/docs/content/docs/models.mdx`

## Acceptance
- [ ] The ADR supersedes the 0038 line and has an index row
- [ ] CONTEXT.md defines the new terms with `_Avoid_` entries and does not use the avoided names
- [ ] The Models guide snippets match the shipped API and the docs site typechecks (`pnpm turbo run test typecheck --filter=docs`)
- [ ] The model README export table lists every new export
- [ ] AGENTS.md verify row for model still holds

## Done summary
Added ADR 0041 (records layer in `@sleekstack/model`): the Record Type / Transformation / Record Adapter / derived Draft split and the spec's resolved decisions, written from the shipped code. It supersedes the "relationships, and a record store as in EmberData" part of ADR 0038's Rejected section. The ADR index has a 0041 row, and the 0038 row notes the supersession. CONTEXT.md gains Record Type, Identity Map, Transformation (model), Record Adapter and Record Reference, each with `_Avoid_` entries (Entity, `Record`, `Ref`, record store). The Models guide gains a Records section covering fields and Transformations, the Identity Map, relationships, `find`/`useRecord`, `commit` with the derived Draft, the optional `./query` entry, client-only SSR, and a checklist. The model README export table lists every new export, including `./query`.

Deviation: the guide test forbids inline code fences and requires every snippet to be included. The guide code therefore lives in three new snippet files outside Touches (apps/docs/snippets/models/records.ts, book-page.tsx, book-query.tsx), and the docs snippet test typechecks them. `model` is not added to `PACKAGES` in entry-points.mjs, which still covers only core/runtime/query/next/react/kit (not ui, router or start); coverage would require generated pages for every model export. Follow-up if wanted.

Tests: `pnpm turbo run test typecheck --filter=docs` green (guide snippets compile, every snippet included). `node scripts/check-links.mjs` ok. The spec Quick command is green (receipt 1ef45f63).

stage: impl-review - ran (codex gpt-6.1-sol fan-out, all three draws SHIP, no findings)
Baseline: green via handoff (verified at 4d20a1a by task 7; only .flow/ changed since).
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: 1ef45f6368da2d2ebc933000d7c090133694d0f1
- Tests: pnpm turbo run test typecheck --filter=docs, pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze
- PRs: