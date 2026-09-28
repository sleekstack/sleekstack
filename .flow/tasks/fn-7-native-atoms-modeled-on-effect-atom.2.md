---
satisfies: [R2, R3]
---
# fn-7-native-atoms-modeled-on-effect-atom.2 AtomStore over ChildScope + shared Tag lookup

## Description
Bind an AtomStore to a scope. Move `useService`'s Tag lookup (Context.getOption + `privateDependencyOf`) into a core helper, `resolveTag(context, tag, requiredBy)`, exported with `@internal` or as a documented export (decide in the task), and switch `packages/react/src/useService.ts` to it with no behavior change. Add `atomStoreFor(scope: ChildScope, opts)`, which builds a store over `scope.inner` with privacy enforced. Effect atoms whose `R` is missing fail with `MissingDependency`/`PrivateDependency`, not a defect. Shadowing: a store over a nested scope sees that scope's providers.

Touches: packages/core/src/atom/scope.ts, packages/core/src/scope.ts (helper only), packages/core/src/index.ts, packages/react/src/useService.ts, packages/core/src/__tests__/atom-scope.test.ts

## Acceptance
- [ ] An Effect atom over a scope resolves a service from that scope, and from a nested scope's shadowing provider.
- [ ] A missing Tag gives Failure(MissingDependency). A private Tag from outside its module gives Failure(PrivateDependency), whose details match `useService`'s.
- [ ] All existing react/core tests pass unchanged after the lookup move.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
