---
satisfies: [R3]
---
# fn-23-reconciling-dom-renderer-keys-host.2 ui: run-time instance identity (frame, ids, ordinals) and keyed components as instances

Touches: packages/ui/src/reactive.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/__tests__/reactive.test.ts, apps/bench/src/jsx-overhead.bench.ts

## Description
Assign component identity at run time (spec Architecture: Instance identity, Keyed components are always instances, Match precedence). This is the early proof point: identity must be cheap enough that fn-22's `jsx-overhead` gate holds, and stable under self re-runs.

**Size:** M
**Files:** `packages/ui/src/reactive.ts`, `packages/ui/src/jsx-runtime.ts`, `packages/ui/src/__tests__/reactive.test.ts`
**Touches:** [packages/ui/src/reactive.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/__tests__/reactive.test.ts]

### Approach
- Add a frame `Context.Reference` next to `Collector` / `RenderScope` / `Handlers` (same `class X extends Context.Reference<X>()` pattern). A frame holds the per-function id `WeakMap` lookup, a per-function ordinal counter for the current run, and (next task) the slot registry.
- In `instance()`: read the parent frame, compute the id (`<fnId>#<ordinal>` or `<fnId>:key:<String(key)>`), count the ordinal for EVERY call (reactive or not), run the body under a fresh child frame, and put `id` and `key` on the returned `Reactive` node. `rerun` reuses the same id and its own frame and never bumps the parent's counters.
- A component with a `key` always returns a `Reactive` node (empty `atoms` and `seen` when it read none) so the key has a DOM host; an unkeyed non-reactive component keeps returning its plain node / `owned()` Fragment unchanged (preserve the `runScopes` and `fallbacks` side channels exactly).
- Keep the non-reactive path allocation-light (one `Map` per frame, no per-call closures beyond what exists). Run `pnpm --filter bench bench:json && pnpm --filter bench compare`; `jsx-overhead` must stay in tolerance (spec Edge Cases: Performance; no lazy fallback).

### Investigation targets
**Required**:
- `packages/ui/src/reactive.ts:9-25,105-127` (`Collector`, `RenderScope`, `instance`), `:59-73` (`runScopes`, `owned`)
- `packages/ui/src/jsx-runtime.ts:30-35` (`jsx`)
- `apps/bench/src/jsx-overhead.bench.ts`, `apps/bench/scripts/compare.ts:8-12`
- `.flow/memory` entry: reactive run scopes must follow committed DOM (memory search `run scopes`)
**Optional**:
- `packages/ui/src/__tests__/reactive.test.ts:22-26` (Reactive-node assertions pattern)

### Key context
fn-21 added `useQuery` / `useMutation` to ui with a ref-counted observer registry tied to the run scope and `Collector`; do not change when those retain/release.

### Acceptance
- [ ] Ids are stable across two runs of the same parent with the same keys/order; a self `rerun` returns the same id and does not change the parent's ordinals.
- [ ] A keyed component that reads no atoms returns a `Reactive` with empty `atoms`; an unkeyed one still returns a plain node (existing assertions unchanged).
- [ ] Ordinal counts every call: a test with `{cond && <A/>}<A/>` shows the documented positional shift.
- [ ] `jsx-overhead` bench stays within tolerance of the committed baseline.
- [ ] Existing ui tests pass unchanged.

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
