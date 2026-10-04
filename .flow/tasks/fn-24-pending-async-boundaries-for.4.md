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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
