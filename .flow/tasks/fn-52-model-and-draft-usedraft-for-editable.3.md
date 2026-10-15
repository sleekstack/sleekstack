---
satisfies: [R13]
---
# fn-52-model-and-draft-usedraft-for-editable.3 Showcase Model/Draft demo

## Description
Add a Model/Draft page to apps/showcase: a Model built with fromDto(dto, ctx), an edit Draft with per-field errors, dirty, reset, a control that changes the source to show pristine re-seed vs dirty keep, a live preview, and a submit through a Form Action using toDto() with its Result; linked from the shell and listed in apps/showcase/README.md; test it; respect the architecture test and size entries; switch the existing task form only if it removes code with no behaviour change. **Touches:** apps/showcase/**

## Acceptance
- R13 holds
- pnpm turbo run test typecheck --filter=showcase green; sleekstack check clean

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
