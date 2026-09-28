# Native atoms, modeled on effect-atom, wired to SleekStack scopes

## Overview
SleekStack-native reactive atoms, with the design taken from `@effect-atom/atom` / `atom-react` and no dependency on that library. Atoms read services from the SleekStack graph (`LayerProvider` scopes) instead of effect-atom's separate `Atom.runtime(layer)`. The Effect-native API lives in `@sleekstack/core` + `@sleekstack/react`. kit wraps it with dependency arrays and no Effect types. Client only.

## Quick commands
```bash
pnpm typecheck && pnpm test
pnpm --filter @sleekstack/core test
pnpm --filter @sleekstack/react test
pnpm --filter @sleekstack/kit test
```

## Design (mirrors effect-atom's model)
- **Atom:** a lazy, keyed node with `read(get)`. `get(other)` records a dependency, and reads recompute when a dependency changes. `Writable` adds `write(ctx, value)`. Constructors: a plain value (writable state), a derived function, an `Effect` (async; its value is a `Result`), and a `Stream` (latest value as a `Result`). `family(key => atom)` is memoized per key with structural keys. `keepAlive` opts out of disposal.
- **Result:** `Initial | Success<A> | Failure<E>`, with a `waiting` flag for refreshes, as in effect-atom. `refresh(atom)` re-runs it.
- **Registry:** holds atom state and subscriptions, reference-counted. A node with no subscribers is disposed after an idle tick (effect-atom's `idleTTL` semantics), which interrupts its fiber and runs its finalizers. Effect atoms run on the owning scope's runtime, so their requirements (`R`) are resolved from that scope's context.
- **Scoping:** each `LayerProvider` owns a registry bound to its component scope. An atom that needs `R` resolves Tags through that scope, so shadowing and privacy work the same as in `useService`. Closing the scope disposes the registry.
- **React (`@sleekstack/react`):** `useAtomValue(atom)`, `useAtomSet(atom)`, `useAtom(atom)`, `useAtomRefresh(atom)` and `useAtomSuspense(atom)`, built on `useSyncExternalStore` against the nearest provider's registry. They are safe under StrictMode's double mount.
- **kit:** `atom(value)`, `atom(fn, deps)` and `atom.family(fn, deps)` take plain values or promises, with deps resolved like kit `layer`. `@sleekstack/kit/react` exports `useAtom`, `useAtomValue` and `useAtomSet`. These suspend while loading and throw `SleekStackError` to the error boundary, matching kit `useService`. The kit public `.d.ts` exposes no `Result`.

## Scope
- core: the Atom, Result, Registry and family primitives, plus a registry bound to a `ChildScope`.
- react: a registry per `LayerProvider`, plus the hooks.
- kit: the `atom` facade and the hooks.
- showcase-kit: an atoms demo. docs: an Atoms guide, with reference pages coming automatically from the fn-6 pipeline.
- ADR 0008: native atoms instead of depending on effect-atom.

## Boundaries / non-goals
- No SSR or hydration: atoms are client only, and reading one during a server render is a documented error.
- No dependency on `@effect-atom/*`, and no `effect` version bump required by it.
- No bridge from Next `query`/`action` to atoms in v1.
- No devtools and no persistence (`Atom.kvs`) in v1.

## Decision context
- Native over a dependency: one service graph, one lifecycle, and no forced `effect` bump (effect-atom 0.7 requires effect ^3.22.1; the repo is on 3.21.2). The design follows effect-atom so its users find the same concepts. (User decision, 2026-09-28.)
- Kit suspends rather than exposing `Result`, to stay consistent with kit `useService`. The Effect-native hooks expose `Result` as effect-atom does.

## Acceptance Criteria
- **R1:** core atoms: value, derived, Effect and Stream atoms, plus `family`, `refresh` and writable atoms, with dependency tracking and recomputation only on change. Errors: an Effect failure gives `Failure` with its Cause; a read cycle between atoms throws a descriptive error; a family with an equal structural key returns the same atom.
- **R2:** lifecycle: an unsubscribed atom is disposed after the idle tick, which interrupts its fiber and runs its finalizers. `keepAlive` atoms persist until the scope closes, and closing the scope disposes every node. Errors: a finalizer failure goes to `onFinalizerError`.
- **R3:** an atom's `R` resolves from the nearest `LayerProvider` scope, including a nested provider's shadowing. Errors: a missing Tag gives `MissingDependency`, a private Tag gives `PrivateDependency`, and using a hook outside a provider throws a descriptive error.
- **R4:** the React hooks re-render only on value change and are StrictMode-safe (no double acquisition, no leaked fibers). `useAtomSuspense` suspends on `Initial`. Errors: a server render throws the documented client-only error.
- **R5:** kit `atom` plus its hooks with no Effect types in the public `.d.ts` (the dts test checks this). Failures reach the error boundary as `SleekStackError` with a code, and loading suspends.
- **R6:** the showcase-kit demo, the Atoms guide and ADR 0008. Errors: the docs coverage and guide tests fail on missing entries.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | core atom primitives | TBD | — |
| R2 | lifecycle / disposal | TBD | — |
| R3 | scope-resolved services | TBD | — |
| R4 | React hooks | TBD | — |
| R5 | kit facade | TBD | — |
| R6 | showcase + docs + ADR | TBD | — |
