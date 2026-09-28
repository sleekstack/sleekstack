---
satisfies: [R1, R2]
---
# fn-7-native-atoms-modeled-on-effect-atom.1 Core atom primitives: Atom, Result, AtomStore, family

## Description
Core atom primitives in `packages/core/src/atom/` (new), with no scope or React wiring yet:
- `Atom`/`Writable` built with `make(value | read | effect | stream)`, plus `writable(read, write)`, `family`, `keepAlive`, `setIdleTTL` and `refresh`. The store has `retain(atom)`, returning a release function.
- The `Result` module: Initial/Success/Failure with `waiting`, and constructors, guards and `match`.
- `AtomStore`, built by `makeAtomStore({ context?, onFinalizerError?, scheduleTask?, defaultIdleTTL? })`, with `get/set/update/subscribe/mount/refresh/batch/dispose`. It uses the node graph, push-invalidate/pull-recompute, microtask removal and idleTTL buckets.
- Effect and Stream atoms fork on a scope per build against the store's context. Invalidation closes that scope.
- The `AtomCycle` tagged error.
Export everything from `packages/core/src/index.ts` with TSDoc on every symbol. Reference: effect-atom@0.6.0 `internal/registry.ts`, `Atom.ts`, `Result.ts` (spec Planning decisions).

Touches: packages/core/src/atom/**, packages/core/src/index.ts, packages/core/src/errors.ts, packages/core/src/__tests__/atom*.test.ts
## Acceptance
- [ ] Derived atoms recompute only on change. A diamond computes each node once per change. `batch` notifies once, with no torn reads.
- [ ] An Effect failure gives `Failure` with its Cause. A refresh keeps the previous value with `waiting: true`. Invalidation interrupts the in-flight fiber (test proves the interrupt).
- [ ] A read cycle throws `AtomCycle` naming the atoms. A family with an equal structural key returns the same atom; a Map-fallback test exists.
- [ ] An unsubscribed node is removed after a microtask; resubscribing in the same tick keeps it. idleTTL delays removal, keepAlive persists, and `retain(atom)` holds a node until released. `dispose` interrupts all and runs finalizers; a finalizer failure goes to `onFinalizerError`.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
