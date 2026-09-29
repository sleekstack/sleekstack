---
satisfies: [R4]
---
# fn-10-islands-lazy-hydrating-react-islands.4 Islands: Effect handoff (registry app scope, per-Island provide, refcount, unmount)

Touches: packages/islands/src/appScope.ts, packages/islands/src/Island.tsx, packages/islands/src/defineIslands.tsx, packages/islands/src/__tests__/**

## Description
Wire kit services into Islands per the spec's Effect handoff and Lifecycle bullets.

**Size:** M
**Files:** packages/islands/src/{appScope.ts,defineIslands.tsx,Island.tsx}, packages/islands/src/__tests__/{appScope,services}.test.tsx
**Touches:** packages/islands/src/**

### Approach
- `appScope.ts`: lazily create one app scope per registry from `defineIslands(map, { provide })`, reference-counted per active Island; close when the count reaches zero, rebuild on next activation; a failed build is not memoized so the next activation retries.
- `Island.tsx`: on activation `hydrateRoot(container, <Boundary><LayerProvider provide={componentEntries} appScope={shared}>...` using the seam from task 3, wrapped in an error boundary that logs and renders nothing; `onRecoverableError` logs with the Island name.
- Root unmount from the wrapper's effect cleanup on a deferred tick.
- Tests (jsdom): `useService` resolves inside an Island; two Islands share one app-scope instance and have separate component-scope instances; last unmount closes the app scope and reverse-order finalization holds; build failure then retry; duplicate Tag between app and component entries raises existing `DuplicateTag`; a kit `action()` call from an Island works.

### Investigation targets
**Required**:
- `packages/react/src/LayerProvider.tsx`, `packages/react/src/managedScope.ts` (after task 3)
- `packages/kit/src/react/hooks.ts` - `useService`
- `packages/kit/src/next/action.ts` - `action()` behavior outside the Next router context

## Acceptance
- [ ] `useService` works inside an Island
- [ ] Islands on one page share one app-scope instance; component scopes are per Island
- [ ] App scope closes when the last Island unmounts and rebuilds after; finalizers run in reverse order
- [ ] Failed app-scope build retries on next activation
- [ ] Error thrown in an Island logs and renders nothing for that Island only

## Done summary
`defineIslands(map, { provide })` now builds one ref-counted app scope per registry (packages/islands/src/appScope.ts). It is built lazily, closed when the last Island root unmounts, rebuilt on the next activation, and a failed build is retried. `<Island provide>` adds component-scope entries. Each root is `Boundary > kit LayerProvider(appScope) > Suspense`, and the server branch nests app and component LayerProviders so `useService` also works during SSR. Distinct Tags that share a key across the app and component entries are logged as `DuplicateTag` for that Island only, while the same Tag shadows. A thrown error logs `[island <name>]` and renders nothing for that Island.

Tests: packages/islands/src/__tests__/services.test.tsx covers the shared app scope and per-Island component scopes, reverse-order close and rebuild, build retry for load and for interaction on the same container, DuplicateTag and shadowing, error isolation, and a kit `effect()` action called from an Island (jsdom). packages/islands/src/__tests__/ssr.test.tsx covers SSR `useService`.

Follow-up: in @sleekstack/react, managedScope adoption does not compare `appScope`. A same-process server render parks a scope, and a client provider with the same `provide` reference can adopt it, which is why the SSR test has its own file. SSR app scopes built by the server LayerProvider are never closed explicitly.

Tier: opus at medium (conductor IMPLEMENTER)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: 98313b337dd70e54131b84f1ecb7addd9c4f318b, b07b967696ed64d34c4ccf650216247f1c8db2e6
- Tests: pnpm --filter @sleekstack/islands test, pnpm --filter @sleekstack/islands typecheck
- PRs: