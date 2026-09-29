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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
