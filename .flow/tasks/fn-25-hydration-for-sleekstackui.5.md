---
satisfies: [R6]
---
# fn-25-hydration-for-sleekstackui.5 ui hydrate: React guests via hydrateRoot

## Description
Guests hydrate their `sleek-guest` wrapper with React's `hydrateRoot` instead of `createRoot`.

**Size:** M
**Files:** packages/ui/src/dom.ts (or hydrate.ts), packages/ui/src/__tests__/hydrate.test.ts
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/__tests__/hydrate*]

### Approach
- `hydrateRoot(host, element, {onRecoverableError, ...})`: route recoverable errors to `onError` as `HydrationMismatch`; keep `onCaughtError`/`onUncaughtError` parity with the createRoot path.
- A server guest error renders '' on the server while the client may render something: that is a defined mismatch with a test.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/dom.ts` build 'Guest' (~l.272), renderGuest
- apps/ui-demo/src/guests.tsx

## Acceptance
- [ ] A guest present in server HTML hydrates and keeps React state across later parent re-runs (R6).
- [ ] Recoverable errors reach `onError`.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
