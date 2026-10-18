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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
