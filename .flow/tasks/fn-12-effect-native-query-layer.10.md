---
satisfies: [R11]
---
# fn-12-effect-native-query-layer.10 Showcase adoption: queries and mutations replace router.refresh

Touches: [apps/showcase/**, apps/showcase-kit/**]

## Description
Both showcases read through query hooks with server prefetch and mutate through `useMutation` (spec: RSC vs cache single source of truth).

**Size:** M
**Files:** apps/showcase/{app/page.tsx,src/client/ProjectView.tsx,src/client/TaskDetail.tsx,src/client/DemoToggle.tsx,src/__tests__/board.test.tsx,e2e/smoke.spec.ts}, apps/showcase-kit equivalents
**Touches:** [apps/showcase/**, apps/showcase-kit/**]

### Approach
- The query cache owns client reads; RSC only prefetches/hydrates; remove `router.refresh()` from mutation paths (`apps/showcase/src/client/ProjectView.tsx:39,54`, `TaskDetail.tsx:30,41,70,81`, showcase-kit `ProjectView.tsx:51`, `TaskDetail.tsx:39,79`). Mutations use `Draft.toDto` Effects and optimistic task moves with rollback.
- `select` uses `TaskModel.fromDto` (Effect with `ProjectNames`); DemoToggle reset/invalidate semantics documented.
- fn-12.3 known gap: a refetch landing mid-mutation is overwritten by the next optimistic recompute; avoid tests that depend on it. Optimistic moves use `Mutation.optimistic`. <!-- Updated by plan-sync: fn-12.3 -->
- `board.test.tsx` and e2e smoke are rewritten for the new flow.
<!-- Updated by plan-sync: fn-12.8 the analyzer (`sleekstack check`) reads cachedQuery/mutation/Query.make/Mutation.make fetchers; keys must be a function returning a tuple literal of literals and its own parameters, e.g. `(id) => ['todo', id]`. Parameters typed any, unknown or a union (including string-literal unions like 'open'|'closed') fail closed as Computed; boolean is allowed. Write showcase keys with no union-typed key parameters, and `sleekstack check` must pass. A fetcher needing a Tag no reaching runtime provides is a MissingDependency at file:line. -->
- Acceptance addition (from fn-12.8): `sleekstack check` passes on both showcases with the new query keys.
<!-- Updated by plan-sync: fn-12.7 showcase-kit adopts through @sleekstack/kit: `cachedQuery({ key, fetch: function*(args){...} })`, `mutation({ run })`, and `useQuery`/`useMutation`/`useQueryClient`/`QueryProvider` from @sleekstack/kit/react; non-serializable keys throw SleekStackError code `Unknown` -->
- Prefetch in the server component with `prefetch([...], { request, overrides })` from `@sleekstack/next`, wrapped in `<HydrateQueries state={...}>` from `@sleekstack/react`. A lazy server read of an un-prefetched query runs on the configured runtime only and does NOT see per-call request/overrides Layers, so every query needing request-scoped services MUST be prefetched. Typed failures reach the client only if opted in at prefetch. <!-- Updated by plan-sync: fn-12.6 -->

### Investigation targets
**Required**:
- `apps/showcase/src/client/ProjectView.tsx`, `TaskDetail.tsx`, `app/page.tsx`
- `apps/showcase/src/models/{contracts,task,task.server}.ts`
- `apps/showcase/src/__tests__/board.test.tsx`

## Acceptance
- [ ] No `router.refresh()` remains in mutation paths of either showcase
- [ ] Create/move/comment update the board via cache with optimistic rollback on the simulated failure
- [ ] Showcase and showcase-kit unit tests, typecheck and e2e smoke pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
