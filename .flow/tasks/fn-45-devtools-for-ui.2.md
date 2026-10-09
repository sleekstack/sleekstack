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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
