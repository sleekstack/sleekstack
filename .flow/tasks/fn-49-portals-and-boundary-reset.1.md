---
satisfies: [R4, R5, R6, R8, R9, R10]
---
# fn-49-portals-and-boundary-reset.1 Boundary as an instance, with reset

## Description
Boundary as an instance, with reset. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/jsx-runtime.ts (Boundary, direct call today), packages/ui/src/reactive.ts (Handlers, withHandlers, scopedRun), packages/ui/src/dom.ts (Instance epoch/fiber), stream/hydrate BoundaryPath numbering, packages/analyze Boundary handling
**Touches:** [packages/ui/src/jsx-runtime.ts, packages/ui/src/reactive.ts, packages/ui/src/dom.ts, packages/ui/src/stream.ts, packages/ui/src/hydrate.ts, packages/analyze/src/components.ts, tests, docs/adr]

### Approach
- Make Boundary a stateful instance like `Pending` (precedent: jsx-runtime comment near Pending, BoundaryPath, scoped fork) so only its subtree re-runs; fallback becomes `(error, reset)`, reset usable as a function or Effect; latest wins via an epoch/fiber guard; close the failed attempt's scope.
- Check `exportNames`/ADR 0019 for the signature change; record the Boundary-as-instance change and any fixture byte change in an ADR.
- Retry must not replay a cached failure: relies on fn-48 not caching rejections.

## Acceptance
- [ ] Fallback receives reset as function and Effect; success replaces the fallback; failing retry shows it again without leaks (R4, R5, R6)
- [ ] Existing hydration and stream fixtures byte-stable or ADR records the change (R8)
- [ ] reset retries a failed lazy import and is a no-op after disposal (R9, R10)


## Done summary
`Boundary` now runs as an instance; its fallback is `(error, reset)`, where `reset()` re-runs only the boundary's subtree (works as `onClick={reset}` and `yield* reset()`), fires once per failure and is dead after disposal. Each attempt runs in its own scope, and `Pending` re-forks failed content on reset so lazy imports retry. ADR 0035 records the new `<sleek-reactive>` host around a Boundary in server markup (one stream fixture updated); tests in packages/ui/src/__tests__/boundary.test.ts.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> SHIP, round 2)
## Evidence
- Commits: 051e54f7c71ada62f10998ef3e54047ca630b23e, a6d5d174f05282325495ddd84a213ce4369562b8
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui --filter=@sleekstack/analyze --filter=ui-demo, pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=ui-demo --filter=docs
- PRs: