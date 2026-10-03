---
satisfies: [R8]
---
# fn-12-effect-native-query-layer.7 Kit facade: dependency-inferred queries and mutations with the dts boundary

Touches: [packages/kit/src/query.ts, packages/kit/src/index.ts, packages/kit/src/react/index.ts, packages/kit/src/__tests__/dts.test.ts, packages/kit/src/__tests__/query.test.tsx]

## Description
Effect-free facade in `@sleekstack/kit` mirroring `atom()`: Tags inferred from `yield*`, no deps arrays (spec: API Contracts).

**Size:** M
**Files:** packages/kit/src/query.ts, packages/kit/src/index.ts, packages/kit/src/react/index.ts, packages/kit/src/__tests__/{dts,query}.test.*
**Touches:** [packages/kit/src/query.ts, packages/kit/src/index.ts, packages/kit/src/react/index.ts, packages/kit/src/__tests__/dts.test.ts, packages/kit/src/__tests__/query.test.tsx]

### Approach
- Follow `packages/kit/src/atom.ts:37-110` (cores WeakMap, coreAtom, overloads). Naming must not clash with kit's Next `query`/`defineQuery` (CONTEXT.md Query/Action terms); pick names in this task and record them in CONTEXT.md draft for the docs task.
- Extend the dts test entry list and forbidden-regex to include the query entry and package (`packages/kit/src/__tests__/dts.test.ts:14-66`); TSDoc `@throws` names adapter functions (`.flow/memory/bug/integration/tsdoc-throws-must-trace-adapter-2026-09-28.md`).

### Investigation targets
**Required**:
- `packages/kit/src/atom.ts:17-110`
- `packages/kit/src/__tests__/dts.test.ts`

## Acceptance
- [ ] Kit query/mutation work through kit hooks with StrictMode tests and no `effect`/core types in public d.ts
- [ ] dts boundary test covers the new entry and forbids `@sleekstack/(core|next|react|query)` references
- [ ] Names chosen and non-clashing with kit Next `query`/`defineQuery`

## Done summary
Added the Effect-free kit facade: `cachedQuery({ key, fetch: function*(args){ yield* Tag } , staleTime, gcTime, retry })` and `mutation({ run, concurrency })` in `@sleekstack/kit`, plus `useQuery`, `useMutation`, `useQueryClient` and `QueryProvider` in `@sleekstack/kit/react`. Names avoid the server-side `query`/`defineQuery` of kit/next; record `cachedQuery`/`mutation` in CONTEXT.md in task 11 (CONTEXT.md is outside this task's Touches). The dts test now forbids `@sleekstack/query` and checks `query.d.ts`. Outside Touches but required: `packages/kit/package.json` and `pnpm-lock.yaml` gained the `@sleekstack/query` workspace dependency. Non-serializable keys throw SleekStackError code `Unknown` (no dedicated code; errors.ts out of scope).

Tier: implementer
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixes 5f1acd7 -> SHIP)
## Evidence
- Commits: e52d9f8898c6b702832705b7cb12f5971ec9c689, 5f1acd7498dd4f36f2172cb1d598d71c6209a9cb
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter @sleekstack/kit typecheck
- PRs: