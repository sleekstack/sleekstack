---
satisfies: [R11]
---
# fn-70-served-records.8 docs: guides, READMEs, llms.md and ADR status for served records

Touches: [apps/docs/content/docs/models.mdx, apps/docs/content/docs/errors.mdx, apps/docs/snippets/models/**, packages/model/README.md, packages/start/README.md, packages/cli/llms.md, docs/adr/0057-served-records.md, docs/adr/README.md]

## Description
Finalize the documentation once the feature works end to end: the records guide, READMEs, the machine-readable `llms.md`, and the ADR's status.

**Size:** S
**Files:** `apps/docs/content/docs/models.mdx` (records section, a served-record example with a snippet under `apps/docs/snippets/models/` that typechecks), `apps/docs/content/docs/errors.mdx` (check rows from task 5), `packages/model/README.md`, `packages/start/README.md`, `packages/cli/llms.md`, `docs/adr/0057-served-records.md` (Status), `docs/adr/README.md`

### Approach
- Describe `records(...)`, `readOnly`, the layer-file-per-record convention and the escape hatch (a hand-written adapter beside it). Keep to what the code does; link ADR 0057.
- Run `generate:api` for the API reference; never hand-edit `apps/docs/content/docs/api/*.md`.
- ADR 0057 Status moves from `Proposed (draft)` to match what fn-68 and fn-69 do at their finalization (accepted only when the code ships).

### Investigation targets
**Required**:
- `apps/docs/content/docs/models.mdx` - existing records section
- `apps/docs/snippets/models/records.ts` - snippet style (snippets typecheck)
- `packages/cli/llms.md` - where server files and codes are listed

### Acceptance
- [ ] `pnpm turbo run test typecheck build --filter=docs` passes with the new snippet
- [ ] `llms.md`, READMEs and the guide name `records`, `readOnly`, `RecordNotFound`, `RecordRejected` and the two analyzer codes
- [ ] ADR 0057 status and index row are consistent with the code that shipped

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
