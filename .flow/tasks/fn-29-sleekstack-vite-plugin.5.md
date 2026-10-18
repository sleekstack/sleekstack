---
satisfies: [R4, R6]
---
# fn-29-sleekstack-vite-plugin.5 Client and SSR builds with example app on the plugin

## Description
Wire `entries` and Vite environments so `vite build` yields client and SSR bundles; dev and build SSR render through `renderToStream` (fn-27). Move ui-demo (or add an example) onto the plugin.

**Size:** M
**Files:** packages/ui-vite/src/entries.ts, src/index.ts, example app config, e2e test
**Touches:** [packages/ui-vite/src/**, apps/playground/**]

### Approach
- Check which of apps/* hosts ui-demo before editing.
- Test: built bundles render and hydrate the example.

### Acceptance
- [ ] Client and SSR bundles build, render, hydrate (R4)
- [ ] Example runs on the plugin (R6)

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
