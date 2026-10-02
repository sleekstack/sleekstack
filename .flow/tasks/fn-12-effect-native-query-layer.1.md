---
satisfies: [R1, R2]
---
# fn-12-effect-native-query-layer.1 @sleekstack/query core: query atom shape, canonical keys, QueryCache registry, staleTime/gcTime/dedupe/retry

Touches: [packages/query/**, .github/workflows/ci.yml, apps/docs/scripts/entry-points.mjs, pnpm-workspace.yaml, pnpm-lock.yaml]

## Description
Scaffold the `@sleekstack/query` package and land the proof point: `Query.make` on the existing native atoms with no `AtomStore`/`Atom` change (spec: Architecture, Query atom shape and QueryCache registry).

**Size:** M
**Files:** packages/query/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/key.ts,src/cache.ts,src/query.ts,src/refetch.ts,src/__tests__/*}, .github/workflows/ci.yml, apps/docs/scripts/entry-points.mjs
**Touches:** [packages/query/**, .github/workflows/ci.yml, apps/docs/scripts/entry-points.mjs, pnpm-lock.yaml]

### Approach
- Scaffold like `packages/islands` (tsconfig extends base, source-only exports, vitest) and add `packages/query` to the CI package loop and to `PACKAGES` in the docs entry-points script.
- Query atom is a writable atom: read runs the fetch, `setSelf` seeds data (used later by setData/optimistic/hydration). Family keyed on a canonical string (stable JSON, sorted object keys); throw `InvalidQueryKey` for functions, BigInt, cycles.
- `QueryCache` (a Tag, replaceable) holds the per-store registry `{atom, updatedAt, observers}` filled on read and cleared by finalizers; staleness and `getData` read it. Do not add fields to `Result`.
- `gcTime` -> family `setIdleTTL`; `keepAlive` for infinite gc; fetch interruption on node removal. `staleTime` only gates triggers (mount, focus, reconnect, non-forced invalidate) and hydrated entries; refetch triggers are pluggable `Stream` sources (no DOM in the core). Retry via `Schedule`, typed failures only.
- Dedupe covers concurrent reads, retries and interval refetches. Follow memory: atom invalidation must track visits, not node state (`.flow/memory/bug/runtime-errors/atom-invalidation-must-track-visits-not-2026-09-28.md`).

### Investigation targets
**Required**:
- `packages/core/src/atom/Atom.ts:135-170` — make overloads, writable, keepAlive, setIdleTTL, family
- `packages/core/src/atom/AtomStore.ts:130,229-253,300` — invalidate, gc eligibility, idleTTL, refresh
- `packages/core/src/atom/Result.ts:37-75` — waiting-preserving results
- `packages/core/src/atom/scope.ts:39` — atomStoreFor
- `packages/islands/package.json`, `.github/workflows/ci.yml:35`, `apps/docs/scripts/entry-points.mjs:7`

### Early proof point
If stale-while-revalidate and dedupe cannot be built without touching `AtomStore`, stop and report before task 2.

## Acceptance
- [ ] Two fresh equal-key arrays resolve to the same atom; concurrent reads share one fetch (test)
- [ ] `staleTime` skips a refetch on mount while fresh and refetches once stale; `waiting` is set while revalidating with the previous value kept
- [ ] `gcTime` removes the node and interrupts an in-flight fetch after the last observer leaves
- [ ] Retry `Schedule` re-runs typed failures only, never defects or interruption; retry plus interval refetch never overlaps
- [ ] Missing service -> `MissingDependency`; bad key -> `InvalidQueryKey`; core has no DOM access
- [ ] Package is in CI and the docs entry-point list; `pnpm --filter @sleekstack/query test` and typecheck pass

## Done summary
Scaffolded @sleekstack/query (in CI loop and docs entry points) with Query.make: a keyed family of writable atoms on the native store (canonical stable-JSON keys, InvalidQueryKey), a replaceable QueryCache Tag resolved per store into a registry {updatedAt, observers}, staleTime-gated mount/refetchOn triggers, deduped refetchInterval, gcTime via setIdleTTL/keepAlive, Schedule retry for typed failures, Stream live queries. No Atom/AtomStore change was needed (proof point holds). Tests in packages/query/src/__tests__/query.test.ts. Follow-up: store.set on an unbuilt key pulls (runs the fetch) first - task 2's setData should account for that.

Tier: implementer (actual_model: claude-opus-5-5)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> NEEDS_WORK -> SHIP)
## Evidence
- Commits: 1cdb6777cbfd94401df1bdc060a001c36f55ccd4, ad1d75d1286bc523bfbfe85b0d6079fd579ae403, 63fbd1bded6b942d737f13c7b4a338d5dadf4b0e, e44a6880026f0f5b1c929e9e4f5e5d411e15c28a
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter showcase typecheck && pnpm --filter showcase test, pnpm --filter @sleekstack/query typecheck
- PRs: