---
satisfies: [R5, R6, R13]
---
# fn-50-sleekstackrouter.4 Actions and prefetching links

## Description
Actions and prefetching links. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/router/src/action.ts, link.tsx; fn-46 action and Result types; fn-48 lazy for route code
**Touches:** [packages/router/src/**, tests]

### Approach
- A route action has the same function/generator/Effect forms as a form action (fn-46 exports the types); links prefetch route code (lazy) and loader on hover/focus unless `prefetch={false}`; dedupe and bounded cache; prefetch errors silent.

## Acceptance
- [ ] Action accepts the three handler forms (R5)
- [ ] Hover/focus prefetch with opt-out (R6)
- [ ] Deduped, bounded prefetch cache; silent errors (R13)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
