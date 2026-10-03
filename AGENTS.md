# AGENTS.md

Rules for agents working in this repo. Anything you can read from `package.json`, `turbo.json` or the code is not repeated here.

## Sources of truth

- Vocabulary: `CONTEXT.md`. Use its terms (Tag, Layer, Module, Kit Operation, ...); never the names under `_Avoid_`.
- Decisions: `docs/adr/`. Changing a decided behavior needs a new ADR, not a silent edit.
- Work tracking: `.flow/` via `flowctl` (see `CLAUDE.md`). No markdown TODOs.

## Commands

pnpm + turbo monorepo. Root: `pnpm test`, `pnpm typecheck`, `pnpm build`.
Scope to one package with `pnpm turbo run <task> --filter=<name>`.

## Verify this change

| You changed | Run |
| --- | --- |
| analyzer (`packages/analyze`) | `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` |
| CLI (`packages/cli`) | `pnpm turbo run test typecheck --filter=sleekstack` |
| kit (`packages/kit`) | `pnpm turbo run test typecheck --filter=@sleekstack/kit...` (dependents included) |
| react (`packages/react`) | `pnpm turbo run test typecheck --filter=@sleekstack/react...` |
| core / runtime | `pnpm turbo run test typecheck --filter=@sleekstack/core...` (or `runtime...`) |
| docs (`apps/docs`) | `pnpm turbo run test typecheck --filter=docs` |
| a public export name | the above, plus `sleekstack check --json` in `apps/showcase-kit` before and after: output must match |

## Rules

- Do not hand-edit generated docs (`apps/docs/content/docs/api/*.md`); run `generate:api`.
- One public name, one meaning across kit entry points (ADR 0019; enforced by `packages/kit/src/__tests__/exportNames.test.ts`).
- Analyzer diagnostics use the closed `AnalyzeCode` union; a new code needs its table row (rule, fix, docs).
