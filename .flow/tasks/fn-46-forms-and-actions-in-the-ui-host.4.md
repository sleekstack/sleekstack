---
satisfies: [R6, R8]
---
# fn-46-forms-and-actions-in-the-ui-host.4 Hydrated submit test, demo and docs

## Description
Hydrated submit test, demo and docs. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** packages/ui/src/__tests__/hydrate.test.ts or a new form test, apps/ui-demo (new host form), packages/ui/README.md, apps/docs side-effects/errors page
**Touches:** [packages/ui/src/__tests__/**, apps/ui-demo/**, packages/ui/README.md, apps/docs/content/docs/**]

### Approach
- Test a resumed/hydrated form submitting before and after hydration; add one ui-demo form using the APIs (none exists today; the demo form is plain React); document in the README and docs.

## Acceptance
- [ ] Hydrated and resumed forms submit through the action with no reload (R6)
- [ ] README documents the APIs and ui-demo has one form (R8)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
