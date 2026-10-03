---
satisfies: [R12]
---
# fn-21-replace-sleekstackquery-with-tanstack.12 query: remove the old engine and record the decision

## Description
Delete the old Effect-native engine and every import of it; record the reversal (R12). The bridge stays.

**Size:** M
**Files:** `packages/query/src/{events,hydrate,infinite,key,mutation,queries,query,select}.ts` and their tests (deleted), `packages/query/src/index.ts` (trim), dependent `package.json` files (drop now-unneeded deps), `pnpm-lock.yaml`, `docs/adr/0014-native-query-layer.md`, new ADR file, `CONTEXT.md`, `README.md`, `packages/query/README.md`, `.flow/specs/fn-16-*` (close)
**Touches:** [packages/query/**, packages/*/package.json, apps/*/package.json, pnpm-lock.yaml, docs/adr/**, CONTEXT.md, README.md]

### Approach
- First `git grep -nE "(Query|Queries|Mutation|Hydrate|QueryEvents|canonicalKey|InvalidQueryKey)[^a-zA-Z]" ` filtered to imports from `@sleekstack/query` must return nothing outside the files being deleted; fix a leftover in the owning earlier task's files only if truly missed.
- Delete the old engine modules and their tests; trim `index.ts` to the bridge exports; drop `@sleekstack/core` from `packages/query/package.json` only if the bridge no longer needs it.
- Update the lockfile by `pnpm install --lockfile-only` and then remove any unrelated importer it adds (a local `apps/sleek-codes` importer has appeared before; it is not part of this change).
- New ADR (next free number; check `docs/adr/README.md`: 0016 and 0017 are claimed by fn-17 and fn-18, so use the next after them): why the owner reversed 0014, accepted costs, `effectFn`, observer bridging. Mark ADR 0014 `Status: Superseded by ADR NNNN`.
- Update `CONTEXT.md` and both READMEs; close the obsolete `fn-16` spec with `flowctl spec close`.

### Investigation targets
**Required**:
- `docs/adr/0014-native-query-layer.md`, `docs/adr/README.md`, `CONTEXT.md`, `packages/query/README.md`

### Key context
This is removal plus docs; behavior changes belong to the earlier tasks. Run the whole workspace typecheck and tests (`pnpm -r typecheck`, `pnpm -r test`) before finishing.

## Acceptance
- [ ] The old engine modules and tests are gone from `packages/query`; its index exports only the bridge; no import of a removed export remains outside ADR history and `.flow/`
- [ ] ADR 0014 is marked superseded and a new ADR records the decision; `fn-16` is closed
- [ ] Workspace typecheck and tests pass; the lockfile has no unrelated importer

## Done summary
Old engine modules/tests deleted; index exports only the bridge; dead kit error codes removed; ADR 0018 added, 0014 superseded; CONTEXT and READMEs updated. Also fixed a task-4 regression (nested kit providers built separate QueryClients) and migrated showcase-kit off the removed kit prefetch (client fetch only). fn-16 was already closed on master.
## Evidence
- Commits: df85da0, 4853a4d
- Tests: pnpm -r typecheck, pnpm -r test
- PRs: