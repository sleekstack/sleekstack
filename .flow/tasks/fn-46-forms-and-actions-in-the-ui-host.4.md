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
Tests prove hydrated (`hydrateMount`) and resumed forms submit through their action with default prevented, including a resumed submit made before the handler chunk loads. The ui-demo new-task form is now a host form: `useAction` with an Effect Schema decode and `useFormStatus` (the React guest form was removed). Docs gained a "Forms and actions" page with a typechecked Schema snippet. CONTEXT.md gained the Form Action term. The ui README already listed the APIs from .2/.3. No public export names changed.

stage: impl-review - ran (codex fan-out base master: 3/3 SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: 02a9e8b24fdf21ccb18b73084f6f9d99c8d77936
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack --filter=ui-demo --filter=docs
- PRs: