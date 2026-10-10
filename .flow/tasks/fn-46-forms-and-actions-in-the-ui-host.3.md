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
The analyzer treats a form's `action` as a handler slot (`isHandlerAttr` in packages/analyze/src/components.ts): closure actions report R/E like `onXxx` closures, `Handler` actions get the NonResumableHandler rule, string URLs are ignored. Fixtures: ui-closures (MissingDependency, UnhandledError, URL) and ui-resumable-jsx (Handler action). ADR 0033 consequence line added. No new AnalyzeCode.

stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: c4cec819a824cc3e7500a8d36a5a524596a45a24, 981a96f9d94dae69ba6b9ae97ce1c6ff9ddcdeae
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack
- PRs: