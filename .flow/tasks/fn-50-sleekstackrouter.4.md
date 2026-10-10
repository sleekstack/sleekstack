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
- Loaders are declared `loader(key, schema, effect)` (schema required) and share one load per loader+pathname that stops when its last reader is interrupted; prefetch must reuse that.
- The client keeps loader results with no expiry and never reloads the same pathname; this task owns the prefetch cache time limit.
<!-- Updated by plan-sync: fn-50-sleekstackrouter.3 made loader schema required, loader client cache has no expiry, shared load per loader+pathname -->

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
