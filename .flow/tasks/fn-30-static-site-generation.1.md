---
satisfies: [R4]
---
# fn-30-static-site-generation.1 Prerender route enumeration

## Description
Build the list of concrete paths to prerender: union of the plugin `prerender: true | string[]` option and each route's `prerender()` param expansion.

**Size:** M
**Files:** packages/ui-vite/src/prerender/enumerate.ts, packages/ui-vite/src/prerender/__tests__/enumerate.test.ts, packages/ui-vite/src/index.ts (option type)
**Touches:** [packages/ui-vite/src/prerender/**, packages/ui-vite/src/index.ts]

### Approach
- Pure function over the `@sleekstack/router` const route table (`packages/router/src/index.ts:19`) plus option and each route's `prerender()`; fill `:param` segments from returned Params.
- Static paths included when option is `true` or listed; dynamic route without `prerender()` yields a skip plus warning naming the route.
- Pick one trailing-slash policy, document it in the option's TSDoc.

### Investigation targets
**Required**:
- `packages/router/src/index.ts` (RouteTable, Params, match)
- `.flow/specs/fn-29-sleekstack-vite-plugin.md` (plugin option shape; this task extends it)

### Key context
fn-29 creates `packages/ui-vite`; if not landed yet, work is blocked on it.

## Acceptance
- [ ] Union of option + route `prerender()` paths, deduplicated
- [ ] Dynamic route without `prerender()` skipped with warning (R4)
- [ ] Unit tests for static, dynamic, duplicate and missing-`prerender()` cases

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
