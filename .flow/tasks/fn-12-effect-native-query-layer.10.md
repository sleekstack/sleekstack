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

- If the showcase mounts the devtools panel, its Queries tab (packages/devtools/src/panel/queries.tsx) lists live query entries (key, state, observers, updatedAt, gc timer) via `QueryEvents.snapshot(store)`; it is empty in production and `QUERY_DEVTOOLS_MARKER` must stay out of client chunks (the showcase bundle test asserts this; keep it passing). <!-- Updated by plan-sync: fn-12.9 -->

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
Both showcases now read the board through a query and write through mutations; no mutation path calls router.refresh(). The Effect showcase prefetches with prefetchApp and hydrates via HydrateQueries. Create/move/comment use Mutation.optimistic with rollback, then invalidate. The kit showcase uses cachedQuery/mutation with a provider-scoped stacked optimistic log, but renders the board client-side only, because the kit facade has no prefetch/hydration API.

Tier: implementer (actual model: claude-opus-5-5)
stage: impl-review - accepted-by-user(NEEDS_WORK after 3 codex rounds; one finding left: showcase-kit has no server prefetch or hydration because @sleekstack/kit has no prefetch, HydrateQueries or codec API. The user accepted client-side fetching for showcase-kit as a documented kit gap; a follow-up spec covers the kit API)
## Evidence
- Commits: 78a0f40fede747dbdfa488227d8aa490fa76d2cf, 53a411d373a4a3ca6904130d6c11d926a5ca0ba2, 7c40a067c13172f9a8fb86effc6a02bd53c32cca, 9d1f1073d7104ec0fb77dd9c016fbda5531a6061
- Tests: baseline: green via handoff (verified at a209074 by fn-12.9), pnpm --filter showcase typecheck && test && build && test:bundle && test:e2e && check, pnpm --filter showcase-kit typecheck && test && build && test:bundle && test:e2e && check
- PRs: