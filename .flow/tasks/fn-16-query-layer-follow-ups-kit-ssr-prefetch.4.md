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
Kit `normalize` maps core `InvalidQueryKey` to a dedicated `InvalidQueryKey` code (test in packages/kit/src/__tests__/errors.test.ts; cachedQuery @throws updated). Optimistic logs now subscribe to their query while live: a settled successful result they did not write (detected by Result identity) becomes the new base and layers re-apply at once; failed refetches never rebase. Tests in packages/query/src/__tests__/mutation.test.ts (keep over refetched base, rollback to refetched base, equal-valued refetch, failed refetch), red before fix.
Scope note: one TSDoc line edited in packages/kit/src/query.ts (outside Touches) at the reviewer's request.

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> NEEDS_WORK -> SHIP)
## Evidence
- Commits: 8bcfbf25964120145b9a2a02c34de7c4d801e67b, 2faece6183dcdf70597ec255ddf0234987e0e6c4, 3774169383195bd35a8a0b9c20371c70ecf24b6a
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/kit --filter=@sleekstack/query --filter=@sleekstack/react
- PRs: