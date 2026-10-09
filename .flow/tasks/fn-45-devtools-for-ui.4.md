---
satisfies: [R8]
---
# fn-45-devtools-for-ui.4 ui-demo wiring and docs

## Description
ui-demo wiring and docs. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** apps/ui-demo/src/main.tsx, apps/docs/content/docs (new page + meta.json)
**Touches:** [apps/ui-demo/src/main.tsx, apps/docs/content/docs/**]

### Approach
- Pass the observer behind `import.meta.env.DEV` in the two existing mounts; add a docs page (api/next/devtools.md is generated: do not edit).

## Acceptance
- [ ] ui-demo opens the panels in development (R8)
- [ ] Docs page lists the four views


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
