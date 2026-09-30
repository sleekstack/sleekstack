---
satisfies: [R1, R6]
---
# fn-11-effect-first-runtime-graph-and-devtools.1 next: Layer-based runtime (configureRuntime layer, runEffect, getRuntime) and error contract

## Description
Build the Effect-native runtime core in `@sleekstack/next`; leave `action`/`query` in place until task 2 moves kit off them.

**Size:** M
**Files:** packages/next/src/runtime.ts, packages/next/src/index.ts, packages/next/src/__tests__/runtime.test.ts
**Touches:** [packages/next/src/runtime.ts, packages/next/src/index.ts, packages/next/src/__tests__/**]

### Approach
- Start only after fn-9.7 lands; read its final `packages/next` and core scope shape first.
- Extend `configureRuntime` (packages/next/src/runtime.ts) with `layer` + `onError`, keeping `provide` working; one ManagedRuntime on a versioned globalThis slot (existing `globalValue` pattern in that file).
- `runEffect(effect, { request?, overrides? })`: `Effect.provide(request)` inside `Effect.provide(overrides)` (order matters: overrides shadow request services); `getRuntime()`.
- Encode the spec's Runtime contract (Architecture section): onError semantics, pass-through of redirect/notFound/interruption, retry after failed build, reconfigure interrupts then disposes, RuntimeNotConfigured.
- Port the showcase's `runApp` (apps/showcase/src/server/runtime.server.ts) as the reference behavior.

### Investigation targets
**Required**:
- packages/next/src/runtime.ts — current slot/generation logic
- packages/next/src/action.ts — current finalizer sink and exit-hook usage (ADR 0009)
- apps/showcase/src/server/runtime.server.ts — behavior to productize
- docs/adr/0009-next-internal-exit-hook.md

### Key context
Memory pitfalls: classify wrappers before generic cause unwrap in defect reporting (kit/src/errors.ts); TSDoc `@throws` names adapter functions.

## Acceptance
- [ ] Runtime contract tests (R6): onError once per defect/finalizer failure, throwing onError swallowed, control-flow throws unreported, failed build retried, reconfigure mid-flight
- [ ] `runEffect` before configure rejects with RuntimeNotConfigured
- [ ] Override shadows a request service built in the same call
- [ ] Existing next tests still pass

## Done summary
Layer-based runtime in @sleekstack/next: configureRuntime({ layer, onError }), runEffect(effect, { request, overrides }), getRuntime; error contract (defects to onError once, finalizer/disposal failures to onFinalizerError ?? onError, control flow and interruption unreported, failed build retried, reconfigure interrupts then disposes). Codex review: round 1 NEEDS_WORK (3 draws), fixed; round 2 SHIP.
stage: plan-sync - skipped(config: deferred to wave end)
## Evidence
- Commits: 13d2af3, cb7b79f
- Tests: pnpm --filter @sleekstack/next test (23 passed), pnpm --filter @sleekstack/next typecheck, pnpm --filter @sleekstack/kit test (89 passed)
- PRs: