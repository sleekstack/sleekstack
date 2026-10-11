---
satisfies: [R3]
---
# fn-45-devtools-for-ui.2 Effect events via a context reference

## Description
Effect events via a context reference. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** packages/ui/src/reactive.ts (useEffect, flushEffects), packages/ui/src/dom.ts (provide the reference in start)
**Touches:** [packages/ui/src/reactive.ts, packages/ui/src/dom.ts, tests]

### Approach
- A `Context.Reference` for the observer defaulting to undefined (pattern: `MountError`, `Frame`); provide it in `start` next to MountError. Server paths run effect slot logic too, so the default must stay undefined.
- Emit start, restart (`slot.restart`) and cleanup (`end`) events with the instance id.

## Acceptance
- [ ] Start, restart and cleanup events for each effect with an instance id (R3)
- [ ] No observer: no behavior or cost change


## Done summary
`useEffect` reports `effect` events (`start`, `restart`, `cleanup`, by instance id and slot index; instance 0 is the mount root) through an `EffectObserver` context reference that defaults to undefined and is provided only by an observed mount. Test in packages/ui/src/__tests__/observer.test.ts; README and mount TSDoc updated; ADR 0022 sizes remeasured (all within limits, limits unchanged).

Follow-up (pre-existing, not in scope): when a component's direct child switches from an instance to a plain element (`on ? <Fx key/> : <p/>`), the old instance is neither disposed nor its effect cleanup run (no `dispose` event, cleanup never called). Wrapped in a div it works.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK: mount observe TSDoc, fixed; re-review SHIP)
baseline: green (ui tests at base, from task .1)
## Evidence
- Commits: dba52b5c8e2d9c8f0ea9e0edf454e683ac131fa7, 37a8787facdaf14c11f62e9d7e1bda0535c1bc68
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui..., apps/ui-demo: vitest run test/size.test.ts
- PRs: