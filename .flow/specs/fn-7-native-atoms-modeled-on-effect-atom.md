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
- **Atom:** a lazy, keyed node with `read(get)`. `get(other)` records a dependency, and reads recompute when a dependency changes (see Planning decisions). `Writable` adds `write(ctx, value)`. Constructors: a plain value (writable state), a derived function, an `Effect` (async; its value is a `Result`), and a `Stream` (latest value as a `Result`). `family(key => atom)` is memoized per key with structural keys. `keepAlive` opts out of disposal.
- **Result:** `Initial | Success<A> | Failure<E>`, with a `waiting` flag for refreshes, as in effect-atom. `refresh(atom)` re-runs it.
- **Registry:** holds atom state and subscriptions, reference-counted. A node with no subscribers is disposed after an idle tick (effect-atom's `idleTTL` semantics), which interrupts its fiber and runs its finalizers. Effect atoms run on the owning scope's runtime, so their requirements (`R`) are resolved from that scope's context.
- **Scoping:** each `LayerProvider` owns a registry bound to its component scope. An atom that needs `R` resolves Tags through that scope, so shadowing and privacy work the same as in `useService`. Closing the scope disposes the registry.
- **React (`@sleekstack/react`):** `useAtomValue(atom)`, `useAtomSet(atom)`, `useAtom(atom)`, `useAtomRefresh(atom)` and `useAtomSuspense(atom)`, built on `useSyncExternalStore` against the nearest provider's registry. They are safe under StrictMode's double mount.
- **kit:** `atom(value)`, `atom(fn, deps)` and `atom.family(fn, deps)` take plain values or promises, with deps resolved like kit `layer`. `@sleekstack/kit/react` exports `useAtom`, `useAtomValue` and `useAtomSet`. These suspend while loading and throw `SleekStackError` to the error boundary, matching kit `useService`. The kit public `.d.ts` exposes no `Result`.

## Planning decisions (from research)
- **Reference:** `@effect-atom/atom@0.6.0` + `atom-react@0.6.0` source (the tag whose peer range is `effect ^3.21`, matching the repo). Not the repo head, which has moved to Effect 4.
- **Naming:** CONTEXT.md avoids "registry", so the per-scope container is an **`AtomStore`** (effect-atom's Registry). CONTEXT.md gets `Atom`, `AtomStore` and `Result`, plus a line tying AtomStore to effect-atom's Registry.
- **Algorithm (as in effect-atom):**
  - Nodes keep parents, children and listeners.
  - Writes push invalidation (mark stale); reads pull the recompute, once per node, so diamonds don't double-compute.
  - `store.batch(fn)` commits bottom-up and notifies once.
  - A node with no listeners and no children is removed after a microtask. `idleTTL` (default 400 ms, per-atom override) uses bucketed timers. `keepAlive` opts out.
- **Effect atoms:**
  - Each build forks on a fresh `Scope`, with the store's context provided via `Effect.provide(context)`.
  - Invalidation or removal closes that Scope, which interrupts the fiber.
  - Stream atoms take the latest element.
  - No public `ChildScope` change: the store is created from `{ context: scope.inner, privates, onFinalizerError }` and never exposes `inner`.
- **R resolution (privacy):**
  - Effect atoms run with the scope's **public** `context` (private Tags removed, `Privacy` map attached), never `inner`.
  - A raw `yield* Tag` miss in Effect 3.21 is a defect: `Die(Error("Service not found: <key>"))` from `Context.unsafeGet`. The store maps that defect to a typed failure: `privateDependencyOf(context, key, atomLabel)` gives `PrivateDependency`; anything else gives `MissingDependency`.
  - The key is parsed from Effect's message, and a test pins the format against the installed effect.
  - A single core helper, `resolveTag` (moved from `useService`'s `lookup`), is shared by `useService` and by kit atoms, which resolve their `deps` up front.
  - Tests cover raw reads for public, private, missing and shadowed services, asserting typed failure Causes.
- **Scope-bound disposal:**
  - `atomStoreFor(scope)` registers `store.dispose` as a finalizer on the scope's internal Effect `Scope`, exposed as a new `@internal` field on `ChildScope`; the public interface is unchanged.
  - The store is registered after the services are built, so LIFO closes it first: fibers are interrupted before service finalizers run, for direct `scope.close` as well as through `LayerProvider`.
  - Store finalizer failures go to `onFinalizerError`.
- **Suspense retention:**
  - A suspending read calls `store.retain(atom)`, which holds the node until its promise settles, and then for `idleTTL` so the retry render can subscribe.
  - An abandoned render therefore releases once the load settles and idleTTL passes.
  - Provider or scope disposal releases everything.
  - Test: inside a committed provider, an acquisition longer than idleTTL completes exactly once, and resources are released after abandonment or unmount.
- **Cycles:** a read cycle throws `AtomCycle` (a new core tagged error) synchronously from the read. Hooks surface it to the error boundary.
- **family:** `family(f)` caches by structural key (`Equal`/`Hash`; primitives by value), holding each atom through `WeakRef` + `FinalizationRegistry`, with a plain Map fallback that is documented as never evicting. Nested families are documented as unsupported for GC (effect-atom #426).
- **Per provider:**
  - Each `LayerProvider` owns one `AtomStore`, created with its `ChildScope` and stored on `ProviderState`.
  - Nested providers get their own store, so atom state is per provider, like effect-atom's `RegistryProvider`.
  - The store lives and dies with the provider's `Owned` record, so StrictMode park/adopt keeps it.
  - `close()` disposes the store (interrupting fibers and awaiting finalizers) before the component scope closes. Finalizer failures go to `onFinalizerError`.
  - Hooks called before the scope resolves suspend on the provider's existing scope promise.
- **Hooks:** exactly `useAtomValue`, `useAtomSet`, `useAtom`, `useAtomRefresh` and `useAtomSuspense` (`{ suspendOnWaiting? }`); no `useAtomMount` or `includeFailure` in v1.
  - Built on `useSyncExternalStore`, with subscribe/snapshot memoized per (store, atom) in a WeakMap.
  - `useAtomSuspense` throws a stable promise per node and generation.
  - On `Failure` it rethrows `Cause.squash` (core); kit normalizes the error.
- **Client only:** a hook called during a server render (`typeof window === 'undefined'`) throws a documented `AtomsClientOnly` error. Defining atoms in shared modules is fine.
- **kit:**
  - `atom(value)` gives a writable atom.
  - `atom(fn, deps)` passes resolved services to `fn(...services, get)` and accepts a value or a Promise.
  - `atom.family(fn, deps)`.
  - Hooks suspend while `Initial` (or waiting on first load) and throw a normalized `SleekStackError`.
  - `useAtomSet` returns `(value | (prev) => value) => void`.
  - The public `.d.ts` exposes no `Result`, which the kit dts test checks.

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
| R1 | core atom primitives | .1 | — |
| R2 | lifecycle / disposal | .1, .2 | — |
| R3 | scope-resolved services | .2, .3 | — |
| R4 | React hooks | .3 | — |
| R5 | kit facade | .4 | — |
| R6 | showcase + docs + ADR | .5 | — |

