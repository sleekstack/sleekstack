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
Added `enumerate(routes, option)` in packages/ui-vite/src/prerender/enumerate.ts: the union of the `prerender: true | string[]` option and each page's `prerender()` expansion, deduplicated, with a warning per skipped dynamic route. `SleekstackOptions.prerender` is typed in packages/ui-vite/src/index.ts (type only; task .2 wires it into the build).

Decisions: the option lives on `sleekstack()`; a route's `prerender()` is an optional field on its page entry in the router's `pages` (no new registry, router package untouched; `PrerenderRoutes` accepts `router()` output structurally). Trailing-slash policy: paths normalized without a trailing slash (root `/`), written to `<path>/index.html`, documented in the option TSDoc. Option off/undefined enumerates nothing. With a list, a dynamic route without `prerender()` warns only if no listed path fills it. Param values are percent-encoded; a missing (non-own or empty) or `.`/`..` param throws naming the route; a throwing `prerender()` is rethrown naming the route. The existing content-tree prerender.ts is unchanged.

Tests: packages/ui-vite/src/prerender/__tests__/enumerate.test.ts covers static, dynamic, duplicate/normalized, missing-prerender() warning, bad params, and a real `router()` input.

Gates: focused enumerate tests and ui-vite typecheck green. Full `pnpm turbo run test build --filter=@sleekstack/ui-vite...` was green at baseline but red at verify on one unrelated test (plugin.test.ts "serves the build-format search index ...": SearchIndexMissing fetch failed); it fails identically with this task's changes removed, so it is inherited/environmental, recorded INCONCLUSIVE, no receipt written.

Tier: implementer: opus at medium

stage: impl-review - ran (codex fan-out NEEDS_WORK, 3 findings fixed, re-review SHIP)
## Evidence
- Commits: 62a32a3af199f616f877b5cbe7dbe0062a6dd3c4, e135b454a0ed34dbaacd2911eaa039f306e1f82c, c711221ece9c442520a9932e35806bfe192d4ab4
- Tests: npx vitest run src/prerender (ui-vite): 10 passed, pnpm turbo run typecheck --filter=@sleekstack/ui-vite: green, pnpm turbo run test build --filter=@sleekstack/ui-vite...: baseline green; verify INCONCLUSIVE - 1 unrelated failure (plugin.test.ts search index fetch failed), reproduces without this task's changes
- PRs: