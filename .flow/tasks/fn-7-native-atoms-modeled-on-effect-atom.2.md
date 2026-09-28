---
satisfies: [R2, R3]
---
# fn-7-native-atoms-modeled-on-effect-atom.2 AtomStore over ChildScope + shared Tag lookup

## Description
Bind an AtomStore to a scope (spec Planning decisions: R resolution, Scope-bound disposal).
- Move `useService`'s Tag lookup into core as `resolveTag(context, tag, requiredBy)` and switch `packages/react/src/useService.ts` to it, with no behavior change.
- Add `atomStoreFor(scope, opts)`. It runs Effect atoms against the scope's public `context` and maps `Service not found` defects to `MissingDependency`/`PrivateDependency` failures via `privateDependencyOf`.
- Add an `@internal` `ChildScope` field exposing the internal Effect `Scope`. `atomStoreFor` registers `store.dispose` on it, so closing the scope interrupts atoms first.

Touches: packages/core/src/atom/scope.ts, packages/core/src/scope.ts, packages/core/src/index.ts, packages/react/src/useService.ts, packages/core/src/__tests__/atom-scope.test.ts
## Acceptance
- [ ] A raw `yield* Tag` in an Effect atom resolves public and shadowed services. A missing Tag gives Failure(MissingDependency) and a private Tag gives Failure(PrivateDependency), as typed failures, not defects, with details matching `useService`'s. A test pins Effect's "Service not found" message format.
- [ ] Closing the core scope directly with a running keepAlive atom interrupts it before service finalizers run (ordering test). A store finalizer failure goes to `onFinalizerError`.
- [ ] All existing react/core tests pass unchanged after the lookup move.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
