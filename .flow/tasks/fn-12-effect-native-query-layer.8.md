---
satisfies: [R9]
---
# fn-12-effect-native-query-layer.8 Analyzer: query and mutation fetchers and static key rule

Touches: [packages/analyze/src/extract.ts, packages/analyze/src/validate.ts, packages/analyze/src/__tests__/fixtures/queries/**, packages/analyze/src/__tests__/fixtures.test.ts]

## Description
Read `Query.make` / `Mutation.make` fetchers like action bodies (spec: Analyzer).

**Size:** M
**Files:** packages/analyze/src/extract.ts, packages/analyze/src/validate.ts, fixtures under packages/analyze/src/__tests__/fixtures/queries/, fixtures.test.ts
**Touches:** [packages/analyze/src/extract.ts, packages/analyze/src/validate.ts, packages/analyze/src/__tests__/fixtures/queries/**, packages/analyze/src/__tests__/fixtures.test.ts]

### Approach
- Reuse `yieldsOf` (`packages/analyze/src/extract.ts:598`) and the `actionOf` root/owner model (`:645`) so a query needing an unprovided Tag is `MissingDependency` at file:line, scoped to reaching runtimes.
- Key rule: static when the key is a function returning a tuple literal of literals and parameters; otherwise fail closed with `Computed`. Fixtures per error, fail-closed on imprecise types (`any`, unions), keyed by enclosing instance (`.flow/memory/bug/integration/static-list-evaluation-must-key-object-2026-09-29.md`).

### Investigation targets
**Required**:
- `packages/analyze/src/extract.ts:431,598-675`
- `packages/analyze/src/__tests__/fixtures.test.ts`

## Acceptance
- [ ] Unprovided Tag in a query/mutation fetcher reports MissingDependency with file:line
- [ ] Non-static key function reports `Computed`; `(id) => ['todo', id]` passes
- [ ] Fixtures assert each error code; `pnpm --filter @sleekstack/analyze test` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
