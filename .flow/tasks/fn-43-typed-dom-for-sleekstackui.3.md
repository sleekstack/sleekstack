---
satisfies: [R7, R8, R9]
---
# fn-43-typed-dom-for-sleekstackui.3 Fix consumers, docs and verify

## Description
Fix consumers, docs and verify. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** apps/ui-demo/src/**, apps/ui-demo/fixtures/**, packages/query/src/__tests__ (host JSX), packages/analyze and cli fixtures, packages/ui/README.md, a new ADR in docs/adr
**Touches:** [apps/ui-demo/**, packages/query/src/__tests__/**, packages/analyze/src/__tests__/fixtures/**, packages/cli/src/__tests__/fixtures/**, packages/ui/README.md, docs/adr/**]

### Approach
- Run typecheck across every consumer using the `@jsxImportSource @sleekstack/ui` pragma and fix real mistakes the new types expose (no runtime edits).
- Re-run analyzer and cli suites (AGENTS.md rows) to prove handler return types are still read the same.
- Update the README rows for `useRef`, `onXxx` and the JSX paragraph; add an ADR for per-tag host typing with `class` canonical, referencing ADR 0026.

## Acceptance
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack` passes with no runtime change (R7, R8)
- [ ] README documents class, typed attributes, events and refs (R9)
- [ ] ADR written and indexed


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
