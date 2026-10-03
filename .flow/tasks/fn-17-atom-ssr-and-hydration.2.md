---
satisfies: [R2]
---
# fn-17-atom-ssr-and-hydration.2 React: renderWithAtoms request registry and server atom reads

Touches: packages/react/src/renderWithAtoms.tsx, packages/react/src/managedScope.ts, packages/react/src/atoms.ts, packages/react/src/LayerProvider.tsx, packages/react/src/context.ts, packages/react/src/index.tsx, packages/react/src/__tests__/**

## Description
Size: M. Request-level server ownership via a request registry, plus server atom reads (R2). Early proof point.

**Touches:** packages/react/src/renderWithAtoms.tsx, packages/react/src/managedScope.ts, packages/react/src/atoms.ts, packages/react/src/LayerProvider.tsx, packages/react/src/context.ts, packages/react/src/index.tsx, packages/react/src/__tests__/**

**Files:**
- `packages/react/src/managedScope.ts` - add `acquireOnServer(registry, id, props, parent, sink)`: looks up `registry.get(id)`, else calls the existing `create(...)` (:113, unchanged) and immediately `state.start()`, records `owned.close` in the registry's ordered list. Add `closeRegistry(registry)` (LIFO, awaited, idempotent). `create`, `acquire`, `adopt`, `park`, `mount` stay untouched; this is the one shared helper for scope opening and atom-store construction, so the wrapper builds no scope itself.
- `packages/react/src/renderWithAtoms.tsx` - new: creates a registry, provides it through context, renders in string or stream mode, calls `closeRegistry` in `finally` / `onAllReady` after the pipe ends / `onShellError` / `onError` / caller `abort()`
- `packages/react/src/context.ts` - registry context (`Map<string, Owned>` + ordered closers)
- `packages/react/src/managedScope.ts` (also) - `useScopeSource(props, parent, sink)`: the ONLY place holding the three-way choice (registry -> `acquireOnServer`, server without registry -> inert state, client -> `acquire`); calls `useId` and reads the registry context itself
- `packages/react/src/LayerProvider.tsx` - render makes a single `useScopeSource(...)` call in place of `acquire`; no branching in the provider. Effects never run on the server, so `mount` is not reached there.
- `packages/react/src/atoms.ts` - drop the `typeof window` guard and `AtomsClientOnly` (:353-358); pass `getServerSnapshot` to `useSyncExternalStore`; update `@throws`
- `packages/react/src/index.tsx` - export `renderWithAtoms`, drop `AtomsClientOnly`
- `packages/react/src/__tests__/renderWithAtoms.test.tsx` - new, node environment

## Approach
- Server semantics (spec Architecture): root opens an app scope from `provide` (or on `appScope`), nested opens a child on its parent's scope via `parent.scope`, exactly as `create` does now; shadowing therefore matches the client. Hooks suspend on `state.scope` as today (`useStore` :356-368) until the store exists.
- `useId` is stable across Fizz retries of a suspended boundary within one render, so a retried provider finds its scope in the registry instead of opening another.
- Close order: `closeRegistry` closes in reverse acquisition order (children were acquired after parents). Each `owned.close` already closes atoms before services (store registered after services at :135).
- No-wrapper server path (`inertServerState`): today's scope behaviour for services is unchanged; atoms read from a per-render `makeAtomStore({ inert: true, hydrate: props.hydrate })` (core option from .1; `hydrate` prop arrives in .3, so accept it as undefined here). Keep this branch a few lines.
- Coordinate with fn-12 (lands first): it edits `context.ts`, keeps the `AtomsClientOnly` guard in `atoms.ts`, and `HydrateQueries.tsx` has its own server branch via `QueryStoreContext`. Keep `HydrateQueries` working under the wrapper.

## Investigation targets
**Required:**
- `packages/react/src/managedScope.ts` - `create`, `acquire`, `close` ordering
- `packages/react/src/atoms.ts` - `useStore`, `suspensionFor`
- `packages/core/src/scope.ts` - `makeAppScope`, `child` (sync vs async layer opening)
- `packages/react/src/__tests__/nesting.test.tsx` - nested/shadowing fixtures to reuse on the server
**Optional:**
- `.claude/worktrees/fn-12/packages/react/src/HydrateQueries.tsx`, `.claude/worktrees/fn-12/packages/react/src/context.ts`

## Acceptance
- [ ] All five atom hooks render under `renderWithAtoms` in string and stream modes; `AtomsClientOnly` no longer exists
- [ ] Nested providers with own `provide` and a shadowed entry resolve the same services on the server as on the client, for sync and async layers; async opening suspends (stream waits; string renders the Suspense fallback)
- [ ] `useAtomValue` on an unsettled result atom renders `Initial`; `useAtomSuspense` resolves under stream mode
- [ ] All registry scopes close LIFO (finalizer order asserted, no live fibers) after completion, shell error and abort; a retried provider reuses its scope (open count asserted)
- [ ] Two concurrent streaming renders with identical provider shape, different values and interleaved suspended retries see only their own values; parked-scope adoption never called on the server (spy)
- [ ] `LayerProvider` has no server/client branching; the choice lives only in `useScopeSource`
- [ ] Server provider without a wrapper serves atoms from an inert store (no fiber forked); outside a provider the existing error; existing react tests and typecheck pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
