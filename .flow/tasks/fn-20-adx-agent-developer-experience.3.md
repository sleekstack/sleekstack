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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
