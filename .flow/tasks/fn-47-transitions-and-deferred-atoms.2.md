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
Added `useDeferredAtom(source)` (ui): a slot-owned atom; the instance reads `source` and, after each committed run, copies the run's current source into it, so deferred readers re-run after the source commit. Released with the instance; analyzer ConditionalSlot covers it (fixture + slotHooks sync test). Tests in packages/ui/src/__tests__/deferred.test.ts cover R4 (commit order, async re-run, source swap, dispose), R5 and R13 (no emit on unchanged, string render equals source).

stage: impl-review - ran (codex: fan-out NEEDS_WORK on timer not tied to commit and pinned first source, fixed; re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: c2b5adbf903dcbd60c6ccdc2f6383ae0c6193f88, 15450074f19ad073a3b98dccb1767694d42f0837
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack
- PRs: