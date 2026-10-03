---
satisfies: [R4]
---
# fn-12-effect-native-query-layer.3 Mutations: state machine, optimistic updates with ordered rollback, concurrency modes

Touches: [packages/query/src/index.ts, packages/query/src/mutation.ts, packages/query/src/__tests__/mutation.test.ts]

## Description
`Mutation.make` with `idle|pending|success|failure`, optimistic updates and `switch|queue|parallel` concurrency (spec: Mutation, Edge Cases).

**Size:** M
**Files:** packages/query/src/mutation.ts, packages/query/src/__tests__/mutation.test.ts
**Touches:** [packages/query/src/index.ts, packages/query/src/mutation.ts, packages/query/src/__tests__/mutation.test.ts]

### Approach
- State and concurrency are per hook instance by default (a per-call runner object); `Mutation.shared` opts into shared/keyed state.
- Order: `Queries.cancel(key)` -> `onMutate` (returns a rollback Effect) -> `run` -> `onSuccess`/`onError` -> `onSettled`. Failure or interruption runs rollbacks in reverse order so an earlier rollback never wipes a later optimistic write.
- `onMutate` failure aborts before `run`. A Draft's `toDto` Effect is an accepted `run` input shape (Model/Draft pattern in apps/showcase/src/models/contracts.ts).
- fn-12.2 drift: `Queries` (packages/query/src/queries.ts) has `invalidate/refetch/setData/updateData/getData/cancel/reset`; `setData(atom, value)` is sync `void` and takes a value only (no function); use `updateData(atom, f)` where `f` receives `Option` of the previous data. The spec's `Queries.setData(todo, id, updater)` form returning an Effect is NOT built; add that Effect wrapper here (or use `updateData`) for optimistic writes. `setData` cancels an in-flight fetch; `reset` clears unobserved nodes; overrides are store-scoped. Export `Mutation` from packages/query/src/index.ts (`export * as Mutation from './mutation'`). <!-- Updated by plan-sync: fn-12.2 used updateData/value-only setData -->
- An in-flight mutation is not interrupted by unmount unless `interruptOnUnmount`; store disposal interrupts it.

### Investigation targets
**Required**:
- `packages/query/src/queries.ts` (task 2)
- `apps/showcase/src/models/contracts.ts` — resolveDraft/submitDraft

## Acceptance
- [ ] Optimistic write then failure rolls back; two overlapping mutations on one key roll back in reverse order
- [ ] `switch` interrupts the previous run, `queue` serialises, `parallel` overlaps
- [ ] `onMutate` failure never calls `run`; `cancel` precedes `onMutate`
- [ ] Unmount does not interrupt unless `interruptOnUnmount`; store disposal interrupts

## Done summary
Added `Mutation` (make/shared/runner/optimistic) to @sleekstack/query: an atom-backed idle|pending|success|failure runner with cancel -> onMutate -> run -> onSuccess/onError -> onSettled, switch/queue/parallel concurrency, interruptOnUnmount-gated release, and store disposal interruption. Optimistic writes are a per-key log folded over a base, so overlapping rollbacks run in reverse order and never wipe a later write (tests in packages/query/src/__tests__/mutation.test.ts cover each AC and error case).

Tier: implementer
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixed -> SHIP)
Follow-up: a refetch landing mid-mutation is overwritten by the next optimistic recompute (marked ponytail in mutation.ts).
## Evidence
- Commits: beb6ce7cc6714506bf2d5ccced5236eae74d615b, d96a705b8e4bf98bc65b0df6722ebd161b4854ef
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter showcase typecheck && pnpm --filter showcase test, baseline: green via handoff (verified at 9844b57)
- PRs: