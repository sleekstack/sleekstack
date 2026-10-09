---
satisfies: [R4, R5, R13]
---
# fn-47-transitions-and-deferred-atoms.2 useDeferredAtom and its slot

## Description
useDeferredAtom and its slot. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/reactive.ts (new hook after useDerivedAtom/useRef), index.ts, packages/analyze/src/components.ts (checkSlot list and doc comment), slotHooks.test.ts
**Touches:** [packages/ui/src/reactive.ts, packages/ui/src/index.ts, packages/analyze/src/components.ts, tests]

### Approach
- Follow the `useDerivedAtom` slot pattern (`takeSlot`, `slots.atoms.push`, `store.retain` release). The deferred atom notifies after the commit (after `swap`), not in the same flush.
- Add the hook to the analyzer list; the `slotHooks.test.ts` sync test must stay green. Any new AnalyzeCode needs its table row.

## Acceptance
- [ ] Atom follows the source after the commit settles; instance owns and releases it (R4)
- [ ] Same slot rule and analyzer coverage (R5)
- [ ] Unchanged source emits nothing; string render equals source (R13)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
