---
satisfies: [R2, R6, R7]
---
# fn-44-sleekstacktesting.3 Component tests with Testing Library, docs

## Description
Component tests with Testing Library, docs. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** packages/testing/src/__tests__/**, packages/testing/package.json, apps/docs/content/docs/testing.mdx
**Touches:** [packages/testing/**, apps/docs/content/docs/testing.mdx]

### Approach
- Add `@testing-library/dom` and `@testing-library/user-event` as devDependencies (user-event is not in the lockfile yet).
- Package tests: render, a click through user-event, effect cleanup on dispose, an async component under Pending.
- Add a 'Component tests' section to the existing testing docs page with one example.

## Acceptance
- [ ] Testing Library queries and user-event work on the container (R2)
- [ ] The four named tests pass (R6)
- [ ] Docs section with an example test (R7)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
