---
satisfies: [R10]
---
# fn-21-replace-sleekstackquery-with-tanstack.8 analyze: query fetcher reads retargeted, QueryClientTag requirement checked

## Description
Update the Analyzer for the new engine (R10): drop the removed query layer's references and prove the `QueryClientTag` requirement is checked for ui query hooks.

**Size:** M
**Files:** `packages/analyze/src/extract.ts`, `packages/analyze/src/components.ts` (only if needed), analyzer tests and fixtures under `packages/analyze/src/__tests__/`
**Touches:** [packages/analyze/src/extract.ts, packages/analyze/src/components.ts, packages/analyze/src/__tests__/**]

### Approach
- `FETCHER_CALLS` (`packages/analyze/src/extract.ts:41`) names `kit/query#cachedQuery`, `query/query#make`, `kit/query#mutation`, `query/mutation#make`: remove the `query/*` entries, and retarget the kit entries to what task 4 left (a kit query body read like an action body; an `effectFn(...)` body is the new fetcher shape, ids from `libId` in `packages/analyze/src/extract.ts:19-31`: add `core` path `query` if the regex needs it).
- New fixture `ui-query`: a component using `useQuery` is clean under a mount layer providing `QueryClientTag`, and reports `MissingDependency` (right file:line) when it is not provided; follow the `// @error` marker convention in `packages/analyze/src/__tests__/components.test.ts`.
- Remove the `query/` branches that only served the deleted package; keep behavior for everything else (existing tests are the pin).

### Investigation targets
**Required**:
- `packages/analyze/src/extract.ts` (19-31, 41, 750), `packages/analyze/src/__tests__/components.test.ts`
- kit result of task 4, ui result of task 6

### Key context
The Analyzer's component pass treats the UI `Store` as provided at `mount` already (fn-19); `QueryClientTag` is an ordinary Tag the mount layer must provide.

## Acceptance
- [ ] A ui component using `useQuery` is clean when `QueryClientTag` is provided and reports `MissingDependency` when not (R10)
- [ ] No reference to the removed `@sleekstack/query` paths remains in the Analyzer; kit query bodies are still read like action bodies
- [ ] `pnpm --filter @sleekstack/analyze test` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
