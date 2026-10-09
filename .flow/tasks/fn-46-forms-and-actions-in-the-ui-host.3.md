---
satisfies: [R7]
---
# fn-46-forms-and-actions-in-the-ui-host.3 Analyzer coverage for action

## Description
Analyzer coverage for action. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** packages/analyze/src/components.ts (closure, checkSlot list), AnalyzeCode union and its table row, analyzer fixtures
**Touches:** [packages/analyze/src/**, packages/cli/src/__tests__/fixtures/**]

### Approach
- Treat the `action` attribute like an `on*` closure in `closure()`; add the new slot hooks to the checkSlot list; a new AnalyzeCode needs its rule/fix/docs row (AGENTS.md); one spec owns the table edit to avoid merge conflicts.

## Acceptance
- [ ] `sleekstack check` reports an action's error and requirement types as for other handlers (R7)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
