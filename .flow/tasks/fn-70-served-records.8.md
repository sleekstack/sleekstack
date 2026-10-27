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
Documented served records. models.mdx gains a "Served records" section with a three-file snippet under `apps/docs/snippets/models/served/` that typechecks: a record module with a `readOnly` field, a `[id].controller.ts` that default-exports `records(Article)`, and a Layer File that fails with `RecordNotFound` or `RecordRejected`. The model and start READMEs list `readOnly`, `record.change`, `RecordNotFound`, `RecordRejected`, `records` and `recordAdapterLayer`, and the start README describes the Record Controller. `llms.md` gains a Served Record vocabulary line; its generated errors block already listed `RecordsRouteShape` and `RecordsMethodCollision`, and errors.mdx already had both rows from task 5. ADR 0057's Status is now "Accepted ... Built in spec fn-70", matching 0053 and 0054, and its index row reads Accepted. The `generate:api` script runs as the docs gate's pretest/prebuild step; the generated api files did not change.

Outside Touches: commit 8a65a96b edits only the TSDoc `@example` of `records` in `packages/start/src/records.ts`. That example imported a nonexistent `../../src/records/article`, so the docs gate was red before this task (`examples.test.ts`). The commit is separate so it can be dropped or moved.

Baseline: red. `pnpm turbo run test typecheck build --filter=docs` failed in two ways. First, under turbo's default concurrency, `docs:test` and `docs:build` both run `generate:api` into the same `api/.tmp` directory and race (ENOENT). This is a pre-existing tooling race and is not fixed; follow-up: serialize `generate:api` or give each run its own temp directory. Second, the broken `@example` above, which is fixed. The gate was run with `--concurrency=1`.

Note: `llms.md` must stay under 8192 bytes (`llms.test.ts`), so the new line is short; the file now has about 40 bytes left. The file was not prettier-clean at base, and formatting it pushes it over the cap, so it was left unformatted.

Tier: implementer (actual model: claude-opus-5-5)

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 8a65a96b5a847a582b2ac0557241e210d07e5fa8, 38c66221878e84c204ec797e06d4ac32a1825e34
- Tests: pnpm turbo run test typecheck build --filter=docs --concurrency=1, pnpm turbo run test typecheck --filter=sleekstack --filter=@sleekstack/start, baseline: red (pnpm turbo run test typecheck build --filter=docs failed pre-edit: generate:api race + records @example import)
- PRs: