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
Added core `resolveTag` (useService now delegates to it unchanged) and `atomStoreFor(scope, opts)`, which runs Effect atoms on the scope's public context, rewrites `Die(Service not found)` Cause nodes into typed MissingDependency/PrivateDependency failures (rest of the Cause kept), and registers `store.dispose` on the new `@internal ChildScope.scope` so closing the scope interrupts atoms before service finalizers. Tests: packages/core/src/__tests__/atom-scope.test.ts.

Touches deviation: packages/core/src/atom/AtomStore.ts got a 3-line `@internal wrapBuild` option. It was the only way to map defects inside the store so derived atoms also see typed failures.
Follow-up (review contracts:2, left out by the merge): an atom's static Result error type does not include MissingDependency/PrivateDependency; it is typed where the atom is defined, not by the store.

Tier: implementer opus at medium
stage: impl-review - ran (codex gpt-6-astra, 2 rounds, SHIP)
## Evidence
- Commits: d0ec2e0bf207ed73181e9627bc16950161dacf3a, 0da8f4725b18d7a37768434049f07fd03372e144, 0fdb9f2d34680f607a2a1f198cab092e747388a0
- Tests: pnpm typecheck && pnpm test
- PRs: