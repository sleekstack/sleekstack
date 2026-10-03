# ADX: Agent Developer Experience

## Goal & Context

Make SleekStack code written by AI agents correct on the first try and legible to humans. ADX is the discipline of making a framework easy for agents to read, write, and verify.

Grounded in `docs/research/adx-agent-developer-experience.md` (the brief; its scorecard puts SleekStack at about 8-10 of 20). The strongest asset is the static analyzer (ADR 0011). The gaps this spec closes: no consumer-facing agent context, docs not shipped in packages, analyzer errors without fix hints, one name (`effect`) with two meanings, and no measurement.

The brief's evidence on bundled docs is mixed (Vercel eval vs. ETH study). So the spec ships the cheap pieces and an eval that tests whether the docs pay off.

## Architecture & Data Models

- **AGENTS.md**: root contributor `AGENTS.md` (under ~100 lines: exact commands per change type, a verify table, vocabulary rule pointing at `CONTEXT.md`). `CLAUDE.md` stays the Claude-only layer and imports `@AGENTS.md`.
- **Analyzer errors**: `AnalyzeError` (`packages/analyze`) gains `fix: string[]` (enumerated remedies), `docs: string` (stable URL or anchor per code), and `column`/`endLine`/`endColumn` when the checker has them. A single table keyed by error code holds rule text, remedies, and doc URL.
- **CLI**: `sleekstack check` prints fix hints; `--json` includes the new fields; new `sleekstack explain <CODE>` prints rule + remedies from the same table. Exit codes (0/1/2) documented.
- **Shipped docs**: a compact `llms.md` (target under 8KB: canonical patterns, lifetime matrix, error codes, vocabulary) bundled in `@sleekstack/kit` `files`. `sleekstack init-agents` writes/updates a marker-delimited block in the consumer's `AGENTS.md` pointing at it (idempotent, `--no-agents` opt-out).
- **Name collision**: kit exports `effect` from `kit/src/effect.ts` (scope side effect) and `kit/src/next/action.ts` (inline operation runner). Rename one so each public name has one meaning; record in an ADR.
- **Eval**: `evals/` with 10-20 tasks, each judged by `sleekstack check` + typecheck + tests; records pass rate and tokens, with and without the shipped docs.

## API Contracts

- `AnalyzeError`: `{ file, line, column?, endLine?, endColumn?, code, message, fix: string[], docs: string }`.
- `sleekstack explain <CODE>`: exit 0 and prints rule + remedies; exit 2 on unknown code.
- `sleekstack init-agents [--no-agents]`: modifies only the text between its marker comments; creates `AGENTS.md` if absent.
- Renamed kit export per the collision ADR; old name re-exported as deprecated for one release if it is user-facing.

## Edge Cases & Constraints

- `AGENTS.md` carries only non-derivable rules; no ADR or architecture prose pasted in (the brief cites studies where overviews did not help).
- Every error code has remedies and a docs target; a test fails if a code lacks an entry.
- `init-agents` never touches text outside its markers and is a no-op on re-run.
- Bundled docs are generated from or tested against the error-code table so they cannot drift.
- Eval tasks must be deterministic to judge (checker/typecheck/test exit codes), not human-graded.

## Acceptance Criteria

- **R1:** Root `AGENTS.md` exists, under ~100 lines, lists exact commands and a verify-by-change-type table; `CLAUDE.md` imports it.
- **R2:** Every analyzer error code has `fix` remedies and a `docs` target; a test enforces completeness.
- **R3:** `sleekstack check` text and `--json` output include fix/docs (and column where available); `sleekstack explain <CODE>` works; exit codes documented.
- **R4:** `llms.md` ships in the `@sleekstack/kit` tarball (verified by `npm pack --dry-run` in a test) and stays under 8KB.
- **R5:** `sleekstack init-agents` is idempotent, marker-scoped, and honors `--no-agents`; covered by tests.
- **R6:** No two public exports share a name with different meanings; the rename is recorded in an ADR and `CONTEXT.md` is updated.
- **R7:** `evals/` has at least 10 tasks, a runner, and a recorded baseline (pass rate, tokens) with and without bundled docs; the result is written into the brief's open questions.

## Boundaries

In scope: R1-R7.
Out of scope for now (brief recommendations 4, 6, 7, 9, 10): MCP server, core-vs-kit default guidance and mixing lint, codemods and "current shape" page, mirroring CONTEXT.md "Avoid" lists into a lint, skills. Revisit once the R7 eval shows where agents actually fail.

## Decision Context

- The brief's evidence conflicts on context files and bundled docs, so ship small and measure (R7) before adding an MCP server or skills.
- `check --json` is already the context-efficient verifier; an MCP server would duplicate it until the eval shows a gap.
