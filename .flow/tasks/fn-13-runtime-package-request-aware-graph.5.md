---
satisfies: [R4]
---
# fn-13-runtime-package-request-aware-graph.5 Dev-only atom store registry listed in the panel

Touches: packages/core/src/atom/**, packages/react/src/**, packages/react/package.json, packages/devtools/src/atoms/**, packages/devtools/src/index.tsx, apps/playground/src/__tests__/bundle.test.ts

## Description
**Task 1 drift:** the devtools buffer (devEvents/devLive/devEnabled, DevEvent) lives at the `@sleekstack/runtime/internal` subpath (not the main barrel); import from there. Kit already sets `isControlFlow: isNextControlFlow` in its runtime config.

**Touches:** packages/core/src/atom (read-only @internal store inspector), packages/react (managedScope.ts, LayerProvider, new registry subpath export), packages/devtools atoms component (new file), bundle tests

**Files:** packages/core/src/atom/AtomStore.ts, packages/react/src/managedScope.ts and LayerProvider, new packages/react registry subpath and its package.json exports, packages/devtools/src/index.tsx (mount point), new packages/devtools/src/atoms/ component

Core: add an `@internal` read-only enumeration of a store's atoms (AtomStore has none today; update the api-coverage expectations). React: `LayerProvider`/`managedScope` (dev, NODE_ENV-guarded) lazily create and append to a fixed `globalThis` rendezvous list, so stores created before the registry subpath loads are still found; the registry subpath only reads that list (late-load catch-up); LayerProvider and managedScope call it under a NODE_ENV guard so the main barrel imports no registry code. Hold stores weakly or require unregister on unmount (StrictMode double mount, HMR). Component-scope stores (showcase draft editor) must register too. The panel reads the registry client-side (the server handler cannot see browser stores), tolerates a store disposed mid-poll, and merges with the existing `atoms` prop.

## Acceptance
- [ ] Test: panel/registry loaded after an already-mounted provider still lists its store
- [ ] Panel lists atoms of every LayerProvider store including the showcase draft editor in dev
- [ ] A store disposed mid-poll disappears without throwing; unmounted stores leave no ghosts
- [ ] Bundle tests prove no registry code in production client chunks
- [ ] core api-coverage and react tests pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
