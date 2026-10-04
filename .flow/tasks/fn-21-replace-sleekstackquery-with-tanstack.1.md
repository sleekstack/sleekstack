---
satisfies: [R1, R2]
---
# fn-21-replace-sleekstackquery-with-tanstack.1 query: @sleekstack/query bridge with QueryClientTag, QueryClientLive and effectFn

## Description
The shared bridge every consumer imports (R1, R2), added to `@sleekstack/query` next to the old engine, which stays untouched until the last task so the repo builds between tasks.

**Size:** M
**Files:** `packages/query/src/client.ts` (new), `packages/query/src/index.ts` (add exports), `packages/query/package.json` (dependency `@tanstack/query-core`), `packages/query/src/__tests__/client.test.ts` (new)
**Touches:** [packages/query/src/client.ts, packages/query/src/index.ts, packages/query/package.json, packages/query/src/__tests__/client.test.ts, pnpm-lock.yaml]

### Approach
- `QueryClientTag` is an `Effect.Tag` over `QueryClient`. `QueryClientLive(config?)` is a scoped Layer: build the client, `mount()`, finalizer `unmount()` then `clear()`; it also captures the `Context` it was built in so `effectFn` can run effects with the app's services (keep it in a WeakMap keyed by client; no globals).
- `effectFn(effect)` returns `(ctx?: { signal?: AbortSignal }) => Promise<A>`: runs `effect` with the captured context via `Effect.runPromiseExit`, interrupts the fiber on `signal` abort, resolves with the success value, rejects with the original failure value (not a FiberFailure) or the defect. Mirror the rejection contract of `runToNode` (`packages/ui/src/component.ts:34-47`).
- `@tanstack/query-core` is a normal dependency of this package (it exists to bridge it). Export the three names from `index.ts` as plain named exports; do not rename or touch the old namespaces (`Query`, `Queries`, `Mutation`, `Hydrate`, `QueryEvents`).

### Investigation targets
**Required** (read before coding):
- `packages/query/package.json`, `packages/query/src/index.ts`, `packages/query/src/query.ts` (the old engine's scope handling, for conventions only)
- `packages/ui/src/component.ts:34-62` — rejection contract to mirror
- `docs/adr/0014-native-query-layer.md` — what is being replaced
**Optional**:
- `packages/query/src/__tests__/query.test.ts` — test pattern

### Key context
The spec's R-IDs in `.flow/specs/fn-21-replace-sleekstackquery-with-tanstack.md` are authoritative; its API Contracts block is the whole surface of this module.

## Acceptance
- [ ] The client is mounted while the layer scope is open and unmounted and cleared on close; a throwing config function fails the layer with the original error (R1)
- [ ] `effectFn` resolves with the success value, rejects with the original tagged error, rejects with a defect, and interrupts on abort; an unsatisfied Tag rejects with the standard missing-dependency error (R2)
- [ ] The old engine's exports and tests are untouched and still pass; `pnpm --filter @sleekstack/query test` and `typecheck` pass

## Done summary
Added the TanStack bridge to @sleekstack/query (packages/query/src/client.ts): QueryClientTag, scoped QueryClientLive (mount on build; unmount and clear on close; a throwing config thunk fails the layer with the original error, so the layer type is Layer<QueryClientTag, unknown>) and effectFn (works as queryFn (ctx) or mutationFn (vars, ctx), runs with the layer's captured context, abort via runPromiseExit's signal, a pre-aborted signal never starts the effect, rejects with original failure or defect). Old engine untouched. Tests are in packages/query/src/__tests__/client.test.ts.

Note for downstream: the old "no DOM access" test bans addEventListener in packages/query/src, which is why abort goes through Effect's own signal option.

stage: impl-review - ran (codex fan-out NEEDS_WORK, then SHIP after one fix round)
## Evidence
- Commits: 9b67cf77fcb0b499801bfa0feef2c58b4cefd2b2, 50476a3097c5965fe61904b7d18edda74bba0794
- Tests: pnpm --filter @sleekstack/query test, pnpm --filter @sleekstack/query typecheck
- PRs: