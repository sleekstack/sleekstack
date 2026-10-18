---
satisfies: [R3]
---
# fn-29-sleekstack-vite-plugin.4 File-based routes to @sleekstack/router table

## Description
Scan `routesDir`, emit a virtual module exporting a const route table for `routes()` (`packages/router/src/index.ts:19`); params stay inferred from path strings. Add/rename/delete updates via HMR invalidation without restart. No TanStack generator (ADR 0036).

**Size:** M
**Files:** packages/ui-vite/src/routes.ts, src/__tests__/routes.test.ts
**Touches:** [packages/ui-vite/src/**]

### Approach
- Virtual module + `handleHotUpdate`/watcher invalidation.
- Invalid route file error names its path.

### Acceptance
- [ ] Tree consumed by router, updates on add/remove (R3)
- [ ] Invalid route file reports its path (R3)

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
