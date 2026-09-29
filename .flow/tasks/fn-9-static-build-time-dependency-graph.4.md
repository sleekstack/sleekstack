---
satisfies: [R2, R5, R6]
---
# fn-9-static-build-time-dependency-graph.4 Runtime API: no deps arrays, lazy Tag resolution, opts.scope

## Description
`defineEffect(gen, opts?)`, `defineQuery(gen, opts?)`, `effect(gen, opts?)` and `query(gen, opts?)` drop the deps array; the body's `yield*` resolves Tags lazily from the request scope, and `opts.scope: [Tags]` names side-effect-only deps such as `RequestContext`. `tag<T>(name)` keeps working and the literal key stays recoverable statically. Runtime behavior (request scopes, finalizer order, shadowing, error codes) is unchanged.

**Size:** M
**Files:** packages/kit/src/next/action.ts, packages/kit/src/tag.ts, kit next / boundaries / type tests, apps/showcase-kit/src/server/board.actions.ts, apps/showcase-kit app pages and tests
**Touches:** [packages/kit/src/next/**, packages/kit/src/tag.ts, packages/kit/src/__tests__/**, apps/showcase-kit/**]

### Approach
- Start from the current `runGen` in `packages/kit/src/next/action.ts`; replace pre-resolution with on-demand resolution and keep `Cause.squash` handling.
- Lands after task 5: the analyzer already validates yields, so removing the arrays never leaves bodies unchecked. Delete `boardActionDeps` and showcase-kit's graph test array cross-check here.
- Keep `dts.test.ts` green (public types never reference effect or core / next / react).

### Investigation targets
**Required**:
- `packages/kit/src/next/action.ts` — runGen, define*, effect, query
- `packages/kit/src/__tests__/next.test.ts` — positional helper and effect tests
- `packages/kit/src/__tests__/dts.test.ts` — R7 boundary
- `apps/showcase-kit/src/server/board.actions.ts` — call sites, boardActionDeps

### Acceptance
- [ ] No API takes a deps array; `opts.scope` resolves `RequestContext` so request open / close logging still happens
- [ ] All kit and showcase-kit tests pass (ported where they used arrays)
- [ ] Yielding an unprovided Tag still rejects with `MissingDependency`

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

