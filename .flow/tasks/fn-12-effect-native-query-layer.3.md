---
satisfies: [R4]
---
# fn-12-effect-native-query-layer.3 Mutations: state machine, optimistic updates with ordered rollback, concurrency modes

Touches: [packages/query/src/mutation.ts, packages/query/src/__tests__/mutation.test.ts]

## Description
`Mutation.make` with `idle|pending|success|failure`, optimistic updates and `switch|queue|parallel` concurrency (spec: Mutation, Edge Cases).

**Size:** M
**Files:** packages/query/src/mutation.ts, packages/query/src/__tests__/mutation.test.ts
**Touches:** [packages/query/src/mutation.ts, packages/query/src/__tests__/mutation.test.ts]

### Approach
- State and concurrency are per hook instance by default (a per-call runner object); `Mutation.shared` opts into shared/keyed state.
- Order: `Queries.cancel(key)` -> `onMutate` (returns a rollback Effect) -> `run` -> `onSuccess`/`onError` -> `onSettled`. Failure or interruption runs rollbacks in reverse order so an earlier rollback never wipes a later optimistic write.
- `onMutate` failure aborts before `run`. A Draft's `toDto` Effect is an accepted `run` input shape (Model/Draft pattern in apps/showcase/src/models/contracts.ts).
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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
