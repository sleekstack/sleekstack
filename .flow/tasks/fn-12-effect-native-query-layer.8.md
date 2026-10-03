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
<!-- Updated by plan-sync: fn-12.7 kit facade is `cachedQuery` (packages/kit/src/query.ts, call id `kit/query#cachedQuery`) and `mutation` in @sleekstack/kit, with `fetch`/`run` generator bodies; also recognise them (not only `Query.make`/`Mutation.make`) alongside the ACTION_CALLS-style sets in extract.ts:36 -->
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
The analyzer reads `cachedQuery`/`mutation` (kit) and `Query.make`/`Mutation.make` (core) fetchers like action bodies: generator yields, or `R` from an Effect/Stream return (Context.Tag classes and GenericTags, a directly returned Tag, method syntax), checked against reaching runtimes for MissingDependency at file:line. Query keys must be functions returning tuple literals of literals and precisely typed parameters (no any/unknown/unions except boolean), else `Computed`. Fixture: packages/analyze/src/__tests__/fixtures/queries/app.ts.

Note: the core query fixture imports `@sleekstack/query` by relative path, since the analyze package has no dependency on it (package.json is outside this task's Touches). validate.ts is unchanged (action validation is reused as is).

stage: impl-review - ran (codex: fan-out NEEDS_WORK, 4 findings fixed; round 2 NEEDS_WORK, 1 fixed; round 3 SHIP)
Tier: implementer (actual_model: claude-opus-5-5)
## Evidence
- Commits: 4a6282c893afb5ea5227f55363e4423ca7f3c200, 4376230270d347ca4fdcf826a5946d2e48e99963, 6cdce06745b3107f37740a9c45c439c1dc13b49c
- Tests: pnpm --filter @sleekstack/analyze test, pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter showcase typecheck && pnpm --filter showcase test
- PRs: