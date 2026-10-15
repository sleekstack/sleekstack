---
satisfies: [R11]
---
# fn-52-model-and-draft-usedraft-for-editable.3 Showcase Model/Draft demo

## Description
Add a Model/Draft page to apps/showcase (editable profile or task detail with dirty indicator, commit, reset, and a control that changes the Model elsewhere so follow-while-clean and hold-while-dirty are visible), linked from the shell and listed in apps/showcase/README.md; test it; respect the architecture test and size entries; switch the existing task form to useDraft only if it removes code with no behaviour change. **Touches:** apps/showcase/**

## Acceptance
- R11 holds
- pnpm turbo run test typecheck --filter=showcase green; sleekstack check clean

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
