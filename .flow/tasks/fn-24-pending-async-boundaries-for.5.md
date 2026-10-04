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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
