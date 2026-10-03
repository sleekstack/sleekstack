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
Closed `AnalyzeCode` union (16 codes collected from all emit sites; 'K','X','Name','Generator','Layer' were regex noise, 'NonLiteralOptions' is real) with `ERROR_CODES: Record<AnalyzeCode, {rule, fix, docs}>` in packages/analyze/src/errorCodes.ts; every emit site goes through `analyzeError()`, which fills fix/docs. `Location` carries optional column/endLine/endColumn from both loc() helpers, so extraction, validation and component errors all have spans. The docs errors page gains an "Analyzer read errors" section for the 6 codes it lacked (apps/docs/content/docs/errors.mdx, edited per the task's Approach, outside its Touches glob). fn-18's `NonResumableHandler` = one union member + one table entry.

Note: the spec's Quick command uses `--filter=@sleekstack/cli`, but the cli package is named `sleekstack`; ran with `--filter=sleekstack`. Baseline was not run separately before editing; the post-change full `pnpm typecheck && pnpm test` is green.

Tier: opus at medium
stage: impl-review - ran (codex: fan-out NEEDS_WORK on spans for validation/component errors and the EmittedSibling doc; fixed; re-review SHIP)
## Evidence
- Commits: ceb945cf1c87366a54bada443079036d65c7e268, 14f87995761fc80eb71e08068416db9888622570
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/kit, pnpm typecheck && pnpm test
- PRs: