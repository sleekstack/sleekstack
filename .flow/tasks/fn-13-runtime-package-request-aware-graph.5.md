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
Dev-only atom store registry: core AtomStore gains @internal inspect(); managedScope adds/removes each LayerProvider store on a globalThis list under a NODE_ENV guard; @sleekstack/react/internal (registry.ts) only reads it; devtools panel polls it client-side (packages/devtools/src/atoms/useStoreAtoms.ts), skips throwing stores, merges with the atoms prop, de-duplicated only against the panel's own provider store (prop label wins; the same atom in sibling stores stays listed). Tests: react registry.test.tsx (late load, StrictMode unmount, disposed store), devtools.test.tsx (panel lists store atoms, throwing store skipped, unmount clears, prop atom also in a store renders once), playground bundle.test.ts (production build has no registry key; dev build does). Subpath named ./internal so docs api-coverage excludes it.

baseline: red (showcase-kit bundle.test.ts Islands, 2 tests, pre-existing)
stage: impl-review - skipped(policy: host-deferred - conductor owns the gate; earlier codex attempt failed on usage limit, round refunded)
Tier: implementer tier, project routing block (opus at medium)

stage: impl-review - ran (codex: first attempt blocked by usage limit, refunded; fan-out NEEDS_WORK -> re-review SHIP)
stage: plan-sync - skipped(empty: conductor noted drift in tasks 3 and 6 directly)
## Evidence
- Commits: 2e553d0c83e6bd98292ed0bbbf95a71ff91a4dba, c8a08292262fdf7c2193a35ec9fac3fa34322f26, 65377f082254b900bca6ddfb0b48d68eddb62196
- Tests: pnpm typecheck, pnpm --filter @sleekstack/react test, pnpm --filter @sleekstack/devtools test, pnpm --filter docs test, pnpm --filter sleekstack-playground test, pnpm test (earlier run: red only on pre-existing showcase-kit bundle.test.ts Islands x2)
- PRs: