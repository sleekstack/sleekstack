---
satisfies: [R1, R2, R7, R9, R10, R11, R13]
---
# fn-45-devtools-for-ui.1 Observer on the renderer

## Description
Observer on the renderer. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/dom.ts (Env, build, watch, rerun, kill), packages/ui/src/reactive.ts (RunFrame id), tests, apps/bench
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/reactive.ts, packages/ui/src/hydrate.ts, packages/ui/src/__tests__/observer.test.ts]

### Approach
- Add an optional `observe` to `Env` (carried through per-patch spreads) and to the mount/hydrate options; one `env.observe?.(...)` per site, building no event object unless an observer exists (precedent: `Env.post?`).
- Instance id from the run frame; events carry a mount id, ids and plain data only; re-run reason from the `changed` closure in `watch`, listing coalesced causes; adopt event from hydrate.

## Acceptance
- [ ] Create, re-run (with reason), dispose and slot events reach the observer (R2)
- [ ] Events are plain data that survive a structured-clone round trip (R7)
- [ ] Mount id on every event; adopt distinct from create; coalesced reasons listed (R9, R10, R11)
- [ ] Rendering output and existing ui tests unchanged; bench mount-1k/update-1-of-1k within baseline (R1, R13)


## Done summary
Added an optional `observe` to `mount`/`hydrateMount` that reports plain-data `RenderEvent`s (create, adopt, rerun with coalesced atom-label or `parent` reasons, dispose, slot), each stamped with a per-mount id and a page-unique instance id; no observer means no event objects. Tests in packages/ui/src/__tests__/observer.test.ts; README rows updated. Instance ids come from a renderer counter, not the RunFrame (no reactive.ts change needed). Bench compare: mount-1k 0.712 vs 0.770 baseline, update-1-of-1k 0.411 vs 0.390, both OK.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK: stale reasons after unwatch, fixed; re-review SHIP)
baseline: green
## Evidence
- Commits: 32e30010626d860ee5d472559231c273f6d5d26f, c6b5fb12d936cb16d52e0dc8ed89eeffe725226b
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui..., pnpm turbo run typecheck --filter=...@sleekstack/ui, pnpm --filter bench bench:json && pnpm --filter bench compare
- PRs: