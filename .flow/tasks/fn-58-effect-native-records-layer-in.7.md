---
satisfies: [R7]
---
# fn-58-effect-native-records-layer-in.7 Guards: unique names, tree-shaking and size budget

## Description
Prove a Draft-only bundle holds no records code, keep export names unique across the model entries, and remeasure the size budget.

**Size:** S
**Files:** packages/model/src/__tests__/bundle.test.ts, packages/model/src/__tests__/exportNames.test.ts, apps/showcase/test/size.test.ts, apps/showcase/src/size/records.tsx, docs/adr/0022-ui-size-budget-and-publish-gate.md
**Touches:** packages/model/src/__tests__/bundle.test.ts, packages/model/src/__tests__/exportNames.test.ts, apps/showcase/test/size.test.ts, apps/showcase/src/size/records.tsx, docs/adr/0022-ui-size-budget-and-publish-gate.md

### Approach
- Names from task 6 (the `./query` entry, to check across `index` and `query`): `queryOf`, `RecordQuery`. The base bundle must load none of `query` (task 6 left that check to this task); `@sleekstack/query` and `@tanstack/query-core` are optional peers of `model` now.
- Names from task 5 to include: `SaveInFlight`, `SaveResponseError`, `SaveError`, `RecordDraft`, `RecordInput`, `RecordChange`.
- Names from task 4 to include: `useRecord`, `RecordAdapter`, `AdapterTag`, `FindError`, `FetchStrategy`, `AdaptedRecord`.
- Names from task 3 to include in the uniqueness check: `ref`, `refs`, `RecordRef`, `RefField`, `RefsField`, `Related`, `RelationTarget`, `RelationKey`.
- Extend `bundle.test.ts` (Vite build of the entry): a bundle importing only `useDraft` contains no records or query code; `./query` pulls in `@sleekstack/query` only when imported.
- Add a name-uniqueness test for `src/index.ts` and `src/query.ts`, modelled on `packages/kit/src/__tests__/exportNames.test.ts` (kit's test does not cover model).
- Add a `records` entry to the `budgets` array in the showcase size test and a `@sleekstack/model/(.*)` regex to `sourceAlias`; keep the existing model entry (limit 231,000 B gzip) unchanged; update the ADR 0022 table with the measured rows.
- Run the fixture graph check from AGENTS.md before and after; output must match.

### Investigation targets
**Required**:
- `packages/model/src/__tests__/bundle.test.ts` - bundle test shape
- `packages/kit/src/__tests__/exportNames.test.ts` - name uniqueness
- `apps/showcase/test/size.test.ts:9-17,57-64` - alias and budgets

## Acceptance
- [ ] A Draft-only bundle holds no records code
- [ ] Export names are unique across `index` and `query`, and a clash fails the test
- [ ] The existing model size entry still passes unchanged; the new records entry has a budget
- [ ] ADR 0022's table matches the measured values
- [ ] The fixture graph check output is identical before and after

## Done summary
Added the R7 guards. packages/model/src/__tests__/bundle.test.ts now builds a virtual entry: a bundle exporting only `useDraft` renders none of adapter, commit, query, record, registry, relations or transformation and no `@sleekstack/query` or `@tanstack/query-core` module; the base entry loads no query code and `./query` does. New packages/model/src/__tests__/exportNames.test.ts checks one name, one declaration across `src/index.ts` and `src/query.ts` (ADR 0019). Both were checked red on an injected violation (`useRecord` in the Draft-only entry; a `useDraft` export added to query.ts).

Size: new entry apps/showcase/src/size/records.tsx (`useRecord` plus `Post.useDraft` over an adapter Layer), `mount with a record` budget 233,000 B gzip (measured 222,215 B), a `@sleekstack/model/(.*)` source alias; the Draft entry keeps 231,000 B. ADR 0022's table was remeasured (all rows) and gains the records row and an fn-58 note. The fixture graph check output is byte-identical before and after.

Deviation: apps/showcase/test/architecture.test.ts (rule for `size/records`) and apps/showcase/test/fixtures.test.ts (tree count 6 to 7) are outside Touches; both guard every src/ file, so a new size entry needs them.

Baseline: green via handoff (verified at 6f5dd33 by task 6; only .flow/ changed since). Post-edit gate green: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze --filter=showcase (19/19).
stage: impl-review - ran (codex gpt-6.1-sol fan-out, three draws SHIP, no findings)
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: 4d20a1a641916cb08c48b11cbf79a1c9bf38f06e
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze --filter=showcase, fixture graph check (kit-app, effect-app): identical before/after
- PRs: