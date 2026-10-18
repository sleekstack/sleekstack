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

### Investigation targets
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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
