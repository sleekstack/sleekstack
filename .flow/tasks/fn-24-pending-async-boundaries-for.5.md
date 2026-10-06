---
satisfies: [R6]
---
# fn-24-pending-async-boundaries-for.5 analyze: Pending is transparent; fallback R and E count

## Description
Pending must not fall into the generic component path of the Analyzer.

**Size:** S
**Files:** packages/analyze/src/components.ts, packages/analyze/src/__tests__/components.test.ts, packages/analyze/src/__tests__/fixtures.test.ts, packages/analyze/src/__tests__/fixtures/ui-pending/ (new)
**Touches:** [packages/analyze/src/components.ts, packages/analyze/src/__tests__/**]

### Approach
- Add `ui/jsx-runtime#Pending` beside Fragment/Provider/Boundary in `jsx()` (~l.176-215): children's R and E pass through unchanged (return `kids`); the `fallback` prop is a JSX expression, so analyze it through `embedded()` and count its R and E as siblings, like Boundary's fallback.
- No new AnalyzeCode, so errorCodes/llms tests stay untouched; a fallback that suspends is a documented rule, not statically enforced.
- Mirror the `ui-query` fixture for a new `ui-pending` fixture.

### Investigation targets
**Required** (read before coding):
- packages/analyze/src/components.ts jsx() special cases (~l.176-215)
- packages/analyze/src/__tests__/fixtures.test.ts and the ui-query fixture

## Acceptance
- [ ] A child's R and E reach `sleekstack check --json` through Pending (test).
- [ ] The fallback's R and E are reported.
- [ ] Analyzer tests green: `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack`.

## Done summary
The Analyzer now treats `<Pending>` (libId `ui/pending#Pending`, since jsx-runtime re-exports it from ./pending) as transparent: children's R and E pass through, and the `fallback` JSX is analyzed through `embedded()` as siblings. New fixture `ui-pending` (in components.test.ts) covers a child MissingDependency and a fallback UnhandledError.

baseline: green via handoff (verified at f44c401 by fn-24.1)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 2634deaf87bf7f3e8cecb834210788ab3fa9c281
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack
- PRs: