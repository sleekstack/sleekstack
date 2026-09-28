# Client-side atoms (effect-atom) wired to SleekStack scopes

## Overview
Integrate `@effect-atom/atom-react` so atoms can read services from the SleekStack graph. In the Effect-native path, an atom runtime is backed by the `LayerProvider` component scope. In kit, `atom(fn, deps)` uses the same dependency arrays as `layer`/`action`, with no Effect types exposed. Client only.

## Quick commands
```bash
pnpm typecheck && pnpm test
pnpm --filter @sleekstack/react test
pnpm --filter @sleekstack/kit test
```

## Scope
- **Dependencies:** bump `effect` from 3.21.2 to ^3.22.1 or later, as `@effect-atom/atom-react` 0.7.0 requires. Add `@effect-atom/atom` and `@effect-atom/atom-react` to `@sleekstack/react`.
- **`@sleekstack/react`:** a way to get an effect-atom runtime whose services come from the nearest `LayerProvider` scope (component, request and app lifetimes as the graph resolves them). Atoms defined against it resolve Tags through the same graph, shadowing and privacy rules as `useService`. Shape to settle in plan: a `useAtomRuntime()` hook, or an `atomRuntime(provide)` helper that registers with the provider.
- **`@sleekstack/kit`:**
  - `atom(fn, deps, opts?)` takes plain values or promises, like kit `layer`.
  - Writable atoms and `atom.family` follow the same pattern if cheap.
  - `@sleekstack/kit/react` re-exports `useAtom`, `useAtomValue` and `useAtomSet`, with failures converted to `SleekStackError`.
- **Showcase:** a small atoms demo in `apps/showcase-kit`.
- **Docs:** an Atoms guide plus reference coverage, following the fn-6 pipeline.

## Boundaries / non-goals
- No SSR or hydration. Atoms run on the client only, and any server use is a documented error.
- No Next `query`/`action` bridge to atoms in v1.
- No changes to effect-atom itself.

## Decision context
- Chosen: reuse the SleekStack graph instead of effect-atom's own `Atom.runtime(layer)` DI, so there is one source of services per scope.
- Client only (user decision, 2026-09-28): hydration is the riskiest part and is deferred.

## Open questions (resolve before plan)
- Q1: should kit atoms return `Result` (initial/success/failure) to the caller, or suspend like `useService`?
- Q2: should the Effect-native API be a hook (`useAtomRuntime`) or a module-level runtime bound on mount?
- Q3: should the showcase demo also go into `apps/showcase` (Effect-native)?

## Acceptance Criteria
- **R1:** `effect` is bumped. The repo typechecks and every existing test passes. Errors: an install peer conflict fails the task.
- **R2:** an atom run against a `LayerProvider` resolves services from that provider's scope, and a nested provider's shadowing applies. Errors: a missing Tag surfaces `MissingDependency`, a private Tag surfaces `PrivateDependency`, and using it outside a provider throws a descriptive error.
- **R3:** atom subscriptions are released when the provider's scope closes, including under StrictMode's double mount (no leaked fibers and no double acquisition). Errors: a finalizer failure goes to `onFinalizerError`.
- **R4:** kit `atom(fn, deps)` plus the hooks work without Effect types appearing in the public `.d.ts`, which the kit dts test checks. Errors: failures reach the hook caller as `SleekStackError` with a code.
- **R5:** the showcase-kit demo, plus the Atoms guide and reference in apps/docs. Errors: the docs coverage and guide tests fail on missing entries.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | effect bump | TBD | — |
| R2 | atoms resolve via provider scope | TBD | — |
| R3 | lifecycle / StrictMode | TBD | — |
| R4 | kit atom + hooks | TBD | — |
| R5 | showcase + docs | TBD | — |
