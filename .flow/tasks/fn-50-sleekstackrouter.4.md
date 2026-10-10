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
Added route actions (`action(run)`, any form-action form), `Link` (prefetches route code and loaders on hover/focus, `prefetch={false}` opts out, same-origin pathname matching) and `prefetchLoader` (shares the loader's load; an unread prefetch is evicted and its load stopped after 30s on a timer; a page read keeps it for good; errors silent). Tests in packages/router/src/__tests__/link.test.ts; README updated.

baseline: green (router gate green at fn-50.3 receipt)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> claimed-prefetch expiry/pathname/stalled -> NEEDS_WORK timer eviction -> SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: 0ee5ff3b980cfea75e6e51329794f260bfdc5e4b, 8e7f60a5d7fb03201dd56e19838707c6c1a84e20, e816d58ad5311ba14c5b6fea10587fd8db65d6bc
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router...
- PRs: