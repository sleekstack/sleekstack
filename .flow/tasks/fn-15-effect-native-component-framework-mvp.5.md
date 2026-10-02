---
satisfies: [R8]
---
# fn-15-effect-native-component-framework-mvp.5 sleekstack check runs the component pass only for ui projects

## Description
Wire `analyzeComponents` into `sleekstack check`, gated so projects not using `@sleekstack/ui` get byte-identical output and exit codes (R8).

**Size:** S
**Files:** `packages/cli/src/check.ts`, `packages/cli/src/__tests__/check.test.ts`, `packages/cli/src/__tests__/fixtures/ui/`, `packages/cli/README.md`
**Touches:** [packages/cli/**]

## Approach
- Gate on the nearest `package.json` listing `@sleekstack/ui` (follow the `configuredEntries` lookup at `check.ts:~20`). Not listed: no call, nothing changes.
- Listed: merge component errors into `ok`, the plain `file:line code: message` output and a `components` key in `--json` (absent otherwise).
- Keep the ui branch (gate, `analyzeComponents` call, merge) in one helper in `check.ts` so `main()` gains one call, not five branches (plan-review maintainability note).
- The "No roots" exit 2 (`check.ts:~53`) applies only when there are neither runtime roots nor `mount` trees; a ui-only project with mounts can pass.

## Investigation targets
**Required**:
- `packages/cli/src/check.ts` — whole file (67 lines)
- `packages/cli/src/__tests__/check.test.ts` — fixture-driven CLI tests


## Acceptance
- [ ] Existing CLI tests pass unmodified, and `--json` for a non-ui fixture has no new key (R8).
- [ ] A ui fixture with an error exits 1 and prints its file:line code.
- [ ] A clean ui-only fixture exits 0; a project with neither roots nor mounts still exits 2.
- [ ] `pnpm --filter sleekstack test` passes.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
