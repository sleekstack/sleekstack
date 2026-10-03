---
satisfies: [R3]
---
# fn-20-adx-agent-developer-experience.3 cli: fix/docs lines, explain command, documented exit codes

## Description
Surface the table in the CLI.

**Size:** M
**Files:** packages/cli/src/check.ts, packages/cli/src/__tests__/check.test.ts, packages/cli/README.md
**Touches:** [packages/cli/**]

### Approach
- `main(argv, io)` (`check.ts:47`) dispatches only `check`; add `explain` and update usage text. Text formatter `line()` (:77) keeps its output; print indented `fix:`/`docs:` lines after it. `--json` (:78) passes the objects through, so new fields appear automatically.
- Exit codes documented at `check.ts:6`; keep one meaning per code (2 = usage/unknown command or code) and state what a crash returns.
- Follow the capture-`Io` test style in `check.test.ts` with fixtures.

## Acceptance
- [ ] text output keeps the file:line CODE: message line; fix/docs lines follow
- [ ] explain <CODE> prints rule and remedies; unknown code exits 2
- [ ] exit codes documented in one place

## Done summary
CLI text errors keep `file:line CODE: message` and add indented `fix:`/`docs:` lines; `sleekstack explain <CODE>` (derived from ERROR_CODES, wired through bin) prints rule/fixes/docs, unknown code or bad arity exits 2; exit codes defined once in the check.ts header, README points there.

baseline: green via handoff (fn-20.2: pnpm typecheck && pnpm test)
stage: impl-review - ran (codex fan-out NEEDS_WORK: 2 findings fixed; re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 56ee3f4afd8efb1259fc74a157c0bb5f223da304, e234adfb9f2f6d1bf4c4268b01200bfa11e259b0
- Tests: pnpm typecheck, pnpm test, pnpm --filter=sleekstack test (19 passed)
- PRs: