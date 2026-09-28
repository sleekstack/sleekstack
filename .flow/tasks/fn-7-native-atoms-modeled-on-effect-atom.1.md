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
Native atom primitives in packages/core/src/atom (Atom, Result, AtomStore with push-invalidate/pull-recompute, Effect/Stream builds on per-build Scopes, family, lifecycle) plus AtomCycle; tests in packages/core/src/__tests__/atom.test.ts cover every AC. Store defaultIdleTTL defaults to none (microtask removal); the 400ms default belongs to the React layer (.3). Atom-level `refresh` is `ctx.refresh`/`store.refresh`.

Tier: implementer opus at medium
stage: impl-review - ran (codex, 3 rounds, SHIP)
## Evidence
- Commits: 8dd7821fc7f35adb1459e7deb86e52cdd2d69798, 89c8e6dd9685e2c335070c2229cc2f507210c332, 3f2e09b19dec1e12be46c2e9052007928122619a
- Tests: pnpm typecheck && pnpm test
- PRs: