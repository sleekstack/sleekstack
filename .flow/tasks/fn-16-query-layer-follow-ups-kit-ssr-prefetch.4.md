---
satisfies: [R5, R6]
---
# fn-16-query-layer-follow-ups-kit-ssr-prefetch.4 query/kit: InvalidQueryKey code and optimistic recompute rebases on refetch

## Description
Two small query-layer fixes. Depends on task 1 only because both edit `packages/kit/src/errors.ts`.

**Size:** M
**Files:** packages/kit/src/errors.ts, packages/query/src/key.ts, packages/query/src/mutation.ts, packages/query/src/__tests__/mutation.test.ts, packages/kit/src/__tests__/
**Touches:** [packages/kit/src/errors.ts, packages/query/src/key.ts, packages/query/src/mutation.ts, packages/query/src/__tests__/**]

### Approach
- `InvalidQueryKey` is thrown at `packages/query/src/key.ts:30`; add it to kit `SleekStackErrorDetails` and `normalize` so it stops landing in `Unknown`.
- Fix the `ponytail:` at `packages/query/src/mutation.ts:193`: when a refetch lands mid-mutation, take it as the new base and recompute the optimistic layer over it; on failure roll back to that base.
- Read memory: atom-writes-do-not-interrupt-an-in-flight-effect-build.
- Behavior pin: write the failing deterministic test first (refetch resolves between optimistic apply and mutation settle).

## Acceptance
- [ ] unserializable key raises the dedicated kit code (test)
- [ ] refetch mid-mutation keeps optimistic state over the new base (deterministic test)
- [ ] failed mutation rolls back to the refetched base (test)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
