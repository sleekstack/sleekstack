---
satisfies: [R2]
---
# fn-20-adx-agent-developer-experience.2 analyze: closed AnalyzeCode union, error table (rule, fix, docs), column fields

## Description
Structural completeness: a typed `Record<AnalyzeCode, entry>` so a missing entry fails to compile. Collect existing codes from all emit sites; check the odd literals the scout flagged ('K','X','Name','Generator','Layer','NonLiteralOptions') for regex noise before adding them.

**Size:** M
**Files:** packages/analyze/src/model.ts, packages/analyze/src/extract.ts, packages/analyze/src/runtimeRoots.ts, packages/analyze/src/components.ts, packages/analyze/src/validate.ts, packages/analyze/src/errorCodes.ts (new), packages/analyze/src/__tests__/
**Touches:** [packages/analyze/src/**]

### Approach
- `AnalyzeError` is at `model.ts:13-24`; codes emitted at `extract.ts:51,150`, `runtimeRoots.ts:28,96`, `components.ts:22,331,335,348,353`, `validate.ts:16,104-105`.
- `column`/`endLine`/`endColumn` optional; fill from `loc()` (`extract.ts:145`, already has the offset).
- `docs` anchors into the docs app errors page (`apps/docs/content/docs/errors.mdx`); add missing anchors.
- Behavior pin: existing fixture tests (`fixtures.test.ts`, one dir per code) must stay green unchanged.
- Coordinate: fn-18 adds `NonResumableHandler`; whichever lands second adds its table entry.

## Acceptance
- [ ] code union is closed; removing a table entry fails typecheck
- [ ] every existing code has rule, fix[] and docs anchor
- [ ] column set where a node is at hand; existing fixture tests unchanged

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
