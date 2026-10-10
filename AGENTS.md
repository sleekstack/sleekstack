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

| You changed                   | Run                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| analyzer (`packages/analyze`) | `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack`                     |
| CLI (`packages/cli`)          | `pnpm turbo run test typecheck --filter=sleekstack`                                                  |
| kit (`packages/kit`)          | `pnpm turbo run test typecheck --filter=@sleekstack/kit...` (dependents included)                    |
| react (`packages/react`)      | `pnpm turbo run test typecheck --filter=@sleekstack/react...`                                        |
| router (`packages/router`)    | `pnpm turbo run test typecheck --filter=@sleekstack/router...`                                       |
| testing (`packages/testing`)  | `pnpm turbo run test typecheck --filter=@sleekstack/testing`                                         |
| core / runtime                | `pnpm turbo run test typecheck --filter=@sleekstack/core...` (or `runtime...`)                       |
| docs (`apps/docs`)            | `pnpm turbo run test typecheck --filter=docs`                                                        |
| a public export name          | the above, plus `sleekstack check --json` in `apps/showcase-kit` before and after: output must match |

## Rules

- Do not hand-edit generated docs (`apps/docs/content/docs/api/*.md`); run `generate:api`.
- One public name, one meaning across kit entry points (ADR 0019; enforced by `packages/kit/src/__tests__/exportNames.test.ts`).
- Analyzer diagnostics use the closed `AnalyzeCode` union; a new code needs its table row (rule, fix, docs).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
