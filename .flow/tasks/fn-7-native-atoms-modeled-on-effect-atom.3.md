---
satisfies: [R3, R4]
---
# fn-7-native-atoms-modeled-on-effect-atom.3 React atom hooks + per-LayerProvider store

## Description
React wiring in `@sleekstack/react`:
- Each `LayerProvider` owns an AtomStore, created from its ChildScope via `atomStoreFor` (so the scope's close disposes it), held on `ProviderState`, and kept through park/adopt.
- Hooks, exactly: `useAtomValue(atom, f?)`, `useAtomSet(atom)`, `useAtom(atom)`, `useAtomRefresh(atom)` and `useAtomSuspense(atom, {suspendOnWaiting?})`.
- They use `useSyncExternalStore` with memoized per-(store, atom) stores, suspend on the provider's scope promise until it resolves, and throw a stable promise.
- A suspending read calls `store.retain` (spec Suspense retention).
- They throw `AtomsClientOnly` on the server and a descriptive error outside a provider.

Touches: packages/react/src/atoms.ts, packages/react/src/context.ts, packages/react/src/LayerProvider.tsx, packages/react/src/index.tsx, packages/react/src/__tests__/atoms*.test.tsx
## Acceptance
- [ ] A component re-renders only when its atom's value changes (render-count test).
- [ ] StrictMode: no double acquisition and no leaked fibers (counts acquisitions and interrupts). Unmount interrupts running Effect atoms before the scope finalizers run.
- [ ] Inside a committed provider, a suspending acquisition longer than idleTTL completes exactly once. An abandoned render releases after settle + idleTTL.
- [ ] Nested providers have separate atom state, and an atom's R resolves from the nearest provider.
- [ ] useAtomSuspense suspends with a stable promise and rethrows the squashed failure. Calls outside a provider and server render throw documented errors.
## Done summary
Added React atom hooks (useAtomValue/useAtomSet/useAtom/useAtomRefresh/useAtomSuspense, AtomsClientOnly) and one AtomStore per LayerProvider (atomStoreFor, defaultIdleTTL 400). Suspense holds release when a reader commits, or once nothing in the store is pending; timers stop on close. Parked scopes are adopted by props identity, or else by same entries plus the same children shape (fixes the outer-Suspense retry loop for useService and atoms). Effect/Stream atom Results now include MissingDependency | PrivateDependency in their error type.

Review: the flowctl loop escalated at its round cap, and standalone codex reviews fixed every finding except one. Time-sliced, uncommitted siblings with identical entries and children shape can share a store. The conductor accepted this documented ceiling (ponytail comment at LayerProvider.tsx:78): the identity-less matching was already an accepted risk before fn-7, React exposes no identity for an uncommitted instance, and `<LayerProvider id>` / an internal Suspense boundary were rejected (new API surface; the Suspense boundary conflicts with R9). Follow-up in fn-8 candidate 5 (LayerProvider lifecycle).
## Evidence
- Commits: 36a12fa, 353131e, 2c862c0, 0e1e314, 61f250d, e24f7bf, 7a4a1ff
- Tests: pnpm typecheck, pnpm test
- PRs: