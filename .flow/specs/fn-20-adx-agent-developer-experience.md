# ADX: Agent Developer Experience

## Goal & Context

Make SleekStack code written by AI agents correct on the first try and legible to humans. ADX is the discipline of making a framework easy for agents to read, write, and verify.

Grounded in `docs/research/adx-agent-developer-experience.md` (the brief; its scorecard puts SleekStack at about 8-10 of 20). The strongest asset is the static analyzer (ADR 0011). The gaps this spec closes: no consumer-facing agent context, docs not shipped in packages, analyzer errors without fix hints, one name (`effect`) with two meanings, and no measurement.

The brief's evidence on bundled docs is mixed (Vercel eval vs. ETH study), so the spec ships the cheap pieces and an eval that tests whether the docs pay off.

Sequencing: lands after fn-16 (kit surface, new error code) and fn-18 (new analyzer code) so the error table and `llms.md` cover them; fn-19 only risks merge conflicts in `packages/analyze`.

## Architecture & Data Models

- **AGENTS.md**: root contributor `AGENTS.md` (under ~100 lines: exact commands per change type, a verify table, vocabulary rule pointing at `CONTEXT.md`). Both `CLAUDE.md` files keep their flow-next and routing blocks; AGENTS.md does not duplicate them. Root `CLAUDE.md` imports `@AGENTS.md`.
- **Error table (structural completeness)**: `AnalyzeError.code` becomes a closed union; one table typed `Record<code, {rule, fix[], docs}>` makes a missing entry a compile error, so no grep-based completeness test is needed. `docs` anchors into the docs app's errors page. Scope: analyzer codes only; kit runtime codes stay on the errors page.
- **Analyzer errors**: `AnalyzeError` gains optional `column`, `endLine`, `endColumn` (set where the node is at hand via `loc()`), plus `fix` and `docs` from the table.
- **CLI**: text output keeps the `file:line CODE: message` line unchanged and adds indented `fix:`/`docs:` lines beneath it; `--json` gains the new fields (additive). New `sleekstack explain <CODE>` prints rule + remedies. Exit codes (0/1/2) documented in one place.
- **Shipped docs**: `llms.md` (under 8KB, bytes) in `@sleekstack/kit`, generated from the error table plus a hand-written patterns/lifetime/vocabulary core, with a test that fails on drift. Kit gains a `files` field including it.
- **init-agents**: `sleekstack init-agents` (in the cli package) writes/updates a marker-delimited block in the cwd `AGENTS.md` pointing at the kit's `llms.md` (resolved through node resolution, not a hard path). Idempotent; creates the file if absent. No flag: not running the command is the opt-out.
- **Name collision**: the kit `next/action.ts` inline runner `effect` is renamed `runOperation`; kit's `effect()` side-effect (`kit/src/effect.ts`) keeps the name. The old inline name stays as a deprecated alias for one release; the analyzer recognizes both ids. Recorded in ADR 0019 (0016/0017 are reserved by fn-17/fn-18).
- **Eval**: `evals/` with 10-20 tasks, each judged by `sleekstack check` + typecheck + tests. Run manually (not CI: cost and keys), N runs per task, "without docs" = fixture install with `llms.md` removed. Records pass rate and tokens.

## API Contracts

- `AnalyzeError`: `{ file, line, column?, endLine?, endColumn?, code: AnalyzeCode, message, fix: string[], docs: string }`.
- `sleekstack explain <CODE>`: exit 0 prints rule + remedies; exit 2 on unknown code.
- `sleekstack init-agents`: modifies only text between its markers.
- Kit next: `runOperation` (new), `effect` (deprecated alias).

## Edge Cases & Constraints

- `AGENTS.md` carries only non-derivable rules; no ADR or architecture prose.
- Text output stays parseable by tools that read `file:line CODE:`.
- `init-agents` handles duplicated/unbalanced markers (stop with an error, write nothing), CRLF files, and read-only files; it writes atomically.
- Adding `files` to kit must not drop `dist` or types; verified by pack dry-run.
- Rename must update the analyzer ids or `check` silently stops recognizing actions.
- Eval tasks are judged by exit codes, never by hand.

## Acceptance Criteria

- **R1:** Root `AGENTS.md` exists, under ~100 lines, lists exact commands and a verify-by-change-type table; root `CLAUDE.md` imports it without duplicating it (no error surface beyond file existence).
- **R2:** Every analyzer error code has `fix` remedies and a `docs` target, enforced by the type system; `column` is set where the node is at hand. Errors: an unknown code is unrepresentable (compile error).
- **R3:** `sleekstack check` text output adds `fix:`/`docs:` lines under the unchanged error line and `--json` includes the new fields; `sleekstack explain <CODE>` works; exit codes documented. Errors: unknown code exits 2 with usage; unknown subcommand exits 2.
- **R4:** `llms.md` ships in the `@sleekstack/kit` tarball (pack dry-run test), stays under 8KB, and a drift test fails when the error table and `llms.md` disagree. Errors: `files` omission of dist or types fails the pack test.
- **R5:** `sleekstack init-agents` is idempotent and marker-scoped, covered by tests. Errors: unbalanced/duplicated markers exit non-zero without writing; read-only file fails with a clear message; CRLF preserved.
- **R6:** No two kit entry points export the same name with different meanings (enforced by a test); the inline runner is renamed with a deprecated alias recognized by the analyzer; ADR 0019 and `CONTEXT.md` updated. Errors: the deprecated alias still type-checks and is still analyzed.
- **R7:** `evals/` has at least 10 tasks, a runner, and a recorded baseline (pass rate, tokens) with and without bundled docs; the result is written into the brief's open questions. Errors: a task whose judge cannot run reports "unjudged", never pass.

## Boundaries

In scope: R1-R7.
Out of scope (brief recommendations 4, 6, 7, 9, 10): MCP server, core-vs-kit default guidance and mixing lint, codemods and "current shape" page, mirroring CONTEXT.md "Avoid" lists into a lint, skills. Also out: documenting kit runtime error codes in `explain`. Revisit once the R7 eval shows where agents actually fail.

## Decision Context

- The brief's evidence conflicts on context files and bundled docs, so ship small and measure (R7) before adding an MCP server or skills.
- `check --json` is already the context-efficient verifier; an MCP server would duplicate it until the eval shows a gap.
- Rejected a grep-based completeness test for error codes as overkill: a typed `Record` makes it structural.
- Rejected a `--no-agents` flag: the command is opt-in already.

## Quick commands

```bash
pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=@sleekstack/cli --filter=@sleekstack/kit
```

## Early proof point

Task fn-20.2 validates the core approach (a closed code union with a typed table gives completeness without extra tests). If it fails, re-evaluate the table shape before fn-20.3+.
