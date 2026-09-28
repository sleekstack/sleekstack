---
satisfies: [R3, R4]
---
# fn-7-native-atoms-modeled-on-effect-atom.3 React atom hooks + per-LayerProvider store

## Description
React wiring in `@sleekstack/react`:
- Each `LayerProvider` owns an AtomStore, created with its ChildScope (via `atomStoreFor`), held on `ProviderState`, and kept through park/adopt.
- `close()` disposes the store before the component scope closes.
- Hooks: `useAtomValue(atom, f?)`, `useAtomSet(atom)`, `useAtom(atom)`, `useAtomRefresh(atom)`, `useAtomSuspense(atom, {suspendOnWaiting?, includeFailure?})`, `useAtomMount(atom)`. They use `useSyncExternalStore` with memoized per-(store, atom) stores, suspend on the provider's scope promise until it resolves, throw a stable promise, and throw `AtomsClientOnly` on the server and a descriptive error outside a provider.

Touches: packages/react/src/atoms.ts, packages/react/src/context.ts, packages/react/src/LayerProvider.tsx, packages/react/src/index.tsx, packages/react/src/__tests__/atoms*.test.tsx

## Acceptance
- [ ] A component re-renders only when its atom's value changes (render-count test).
- [ ] StrictMode: no double acquisition and no leaked fibers (counts acquisitions/interrupts). Unmount interrupts running Effect atoms before the scope finalizers run (ordering test).
- [ ] Nested providers have separate atom state, and an atom's R resolves from the nearest provider.
- [ ] useAtomSuspense suspends with a stable promise and rethrows the squashed failure. Calls outside a provider and server render throw documented errors.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
