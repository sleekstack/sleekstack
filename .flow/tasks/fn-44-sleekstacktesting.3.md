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
Added four component tests in packages/testing/src/__tests__/components.test.ts (role/text queries via @testing-library/dom, a user-event click, effect cleanup on dispose, async component under Pending) and a "Component tests" section in apps/docs/content/docs/testing.mdx with a typechecked snippet (apps/docs/snippets/testing/component.test-example.ts; docs guide test forbids inline fences). Testing Library + user-event are devDependencies of @sleekstack/testing and docs. No public exports changed, so generate:api/ADR/demo not needed.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out: 3/3 SHIP)
## Evidence
- Commits: aea169ff272bc58831c6ec6826983a6848a8b5fd
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/testing --filter=docs
- PRs: