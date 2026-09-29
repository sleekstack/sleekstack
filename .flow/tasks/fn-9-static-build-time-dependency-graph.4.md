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
Removed deps arrays from defineEffect/defineQuery/effect/query (now `(gen, opts?)`, `.deps` gone); `yield* Tag` reads the request scope's public Context on demand, a miss maps to MissingDependency/PrivateDependency; `opts.scope` builds side-effect-only Tags (RequestContext) up front. Analyzer reads `opts.scope` as edges and drops UndeclaredDependency; boardActionDeps + graph.test cross-check deleted; tests/docs ported.

stage: impl-review - skipped(policy: host-deferred - conductor owns the gate)

Review: independent host review SHIP (no P0/P1). Known: nested ops copying Context surface HandlerFailed instead of MissingDependency.
## Evidence
- Commits: c360c69e45463a4e4ec67b4ed751cf105d387517
- Tests: pnpm test (kit 89/89, core 73, next 13, analyze 14/14, showcase-kit green; apps/showcase requests.test flaky/red from concurrent uncommitted edits in apps/showcase, not this task), pnpm --filter showcase-kit check (ok, 10 nodes), pnpm typecheck (9/9), pnpm lint (only sleek-codes configures lint; fails, unrelated)
- PRs: