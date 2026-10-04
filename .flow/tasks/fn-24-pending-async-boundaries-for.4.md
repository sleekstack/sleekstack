---
satisfies: [R4]
---
# fn-24-pending-async-boundaries-for.4 ui query: useSuspenseQuery with shared observer retain, tagged QueryFailed error

## Description
Adds the waiting query primitive. TanStack errors are plain `Error`, which `Boundary` cannot match (it needs a string `_tag`), so failures are wrapped in a tagged error.

**Size:** M
**Files:** packages/ui/src/query.ts, packages/ui/src/index.ts (and the query entry), packages/ui/src/__tests__/query.test.ts, packages/ui/src/__tests__/requirements.test-d.ts, packages/ui/src/__tests__/errors.test-d.ts
**Touches:** [packages/ui/src/query.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/query*, packages/ui/src/__tests__/*.test-d.ts]

### Approach
- Extract the shared registry/retain block (observer per store+hash, `refs++`, `Scope.addFinalizer` release) from `useQuery` and reuse it; do not copy it.
- Wait with `Effect.tryPromise` over `client.fetchQuery` (respects `staleTime`; `ensureQueryData` would return stale data) passing the abort `signal` so an interrupt cancels the fetch; fail with a new tagged `QueryFailed { cause }`.
- Return `data` (not the observer result). `enabled: false` is rejected at the type level; an unprovided query client fails with the existing tagged error.
- Under `renderToString` (no RenderScope) take the no-scope branch before touching `registries`: await and return the data without subscribing.
- Check the name against ui exports by hand (kit's exportNames.test.ts does not scan ui) and against kit/react re-exports of TanStack's own `useSuspenseQuery`.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/query.ts` useQuery/useMutation, registries (~l.25-100)
- `packages/ui/src/__tests__/query.test.ts` go()/counting()/tick() helpers
- `.flow/memory/bug/runtime-errors/subscribe-only-suspense-promise-hangs-2026-10-02.md`
- `.flow/memory/bug/runtime-errors/captured-context-for-rerun-must-own-2026-10-03.md`

## Acceptance
- [ ] `useSuspenseQuery` resolves under Pending on the client and under `renderToString`; a failed query surfaces `QueryFailed` through a Boundary (R4).
- [ ] Observer retain count rises on read and returns to 0 on unmount/supersede; a fetch in flight is aborted on interrupt.
- [ ] Type tests: E is `QueryFailed | <query client tag error>`, R includes the query client and Store.
- [ ] `useQuery` tests unchanged.

## Done summary
Added `useSuspenseQuery` and the tagged `QueryFailed` error to `@sleekstack/ui/query`. The observer retain block is now a shared `retain` helper that `useQuery` and `useSuspenseQuery` both call. `useSuspenseQuery` waits on `fetchQuery`, calls `cancelQueries` when the abort signal fires on interrupt, returns the data, and with no RenderScope (renderToString) awaits without subscribing.

Deviations: no runtime "query client not provided" tagged error exists. An unprovided client is caught at compile time through R, so E is just `QueryFailed`, and the type test pins `Effect<T, QueryFailed, QueryClientTag | Store>`. The Boundary test runs without a Pending wrapper because routing a Pending content failure to a Boundary is fn-24.2's work. Once .2 lands, a test with Pending wrapped around the failing query is a worthwhile follow-up. index.ts is unchanged because query is its own `./query` entry. The name `useSuspenseQuery` appears nowhere else in ui, kit or react.

baseline: green via handoff (verified at f44c401 by fn-24.1)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: ce420f33bf091700e55a81b3f50bdf04256989ad
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=ui-demo
- PRs: