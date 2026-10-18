---
satisfies: [R2, R5]
---
# fn-30-static-site-generation.3 Example app prerender, hydration and static-serve test, docs

## Description
Enable prerender in the example app, prove hydration and static serving, and document the option.

**Size:** M
**Files:** example app vite config and routes (ui-demo equivalent, or new example), its test, packages/ui-vite/README.md
**Touches:** [packages/ui-vite/README.md, packages/ui-vite/src/__tests__/**, the example app dir]

### Approach
- Build the example, serve `dist` with a plain static file server in a test, fetch each prerendered path.
- Hydrate a prerendered page (pattern: `packages/ui/src/__tests__/hydrate.test.ts`) and assert no `HydrationMismatch`.
- Document `prerender` option, route `prerender()`, trailing-slash policy.

### Investigation targets
**Required**:
- `packages/ui/src/hydrate.ts`
- `packages/ui/src/__tests__/hydrate.test.ts`

## Acceptance
- [ ] Prerendered page hydrates without HydrationMismatch (R2)
- [ ] Built output served from a static file server returns correct pages in a test (R5)
- [ ] README documents the options
- [ ] `pnpm turbo run test build --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
