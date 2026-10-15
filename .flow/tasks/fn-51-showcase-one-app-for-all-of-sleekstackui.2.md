---
satisfies: [R2, R3, R4, R5, R6]
---
# fn-51-showcase-one-app-for-all-of-sleekstackui.2 Move CLI/analyzer fixtures, fix CI, docs tests and AGENTS.md

## Description
Replace the two Next.js app dependencies: re-point packages/cli check.test.ts and the analyzer fixtures to fixtures under packages/cli or packages/analyze covering the same cases; update AGENTS.md export-name rule, .github/workflows/ci.yml (drop deleted apps, build/bundle/e2e for showcase where they apply, the require-scripts list), apps/docs guides test and showcases.mdx, root and package READMEs that link the deleted apps. **Touches:** packages/cli/**, packages/analyze/**, .github/workflows/ci.yml, AGENTS.md, apps/docs/**, README.md, packages/*/README.md

## Acceptance
- R2, R3, R4, R5, R6 hold
- pnpm turbo run test typecheck for cli, analyze, docs green; grep finds no showcase-kit or ui-demo outside .flow/

## Done summary
No file outside `.flow/` names `showcase-kit` or `ui-demo` any more, and no file points at a page of the deleted Next.js showcase. In CI the graph check runs on `showcase`, the require-scripts list names only packages that exist, and the deleted apps' steps are gone. AGENTS.md's export-name check now runs on the CLI fixtures (`for app in kit-app effect-app; do (cd packages/cli/src/__tests__/fixtures/$app && node ../../../../bin/cli.js check --json --entry runtime.ts); done`). The command was run as written: exit 0, and two runs gave the same output. AGENTS.md also has a showcase verify row. `showcases.mdx` now describes the one Vite showcase, and the guides test allows includes only from the snippets and `apps/showcase`. `islands.mdx` and `nextjs.mdx` now link to package tests where they used to link to the deleted pages, and `queries.mdx` drops "the showcases". The root, kit and devtools READMEs, a `check.ts` doc comment and two analyzer fixture comments no longer name the deleted apps.

Coverage dropped (no longer run anywhere; CI's `e2e` job is deleted because the Vite showcase has no e2e or `test:bundle` script):
- `showcase` (Next) `test:bundle`: client chunks have no `SERVER_ONLY_MARKER`, the server output does, and client chunks have no `DEVTOOLS_MARKER` or `QUERY_DEVTOOLS_MARKER`.
- `showcase-kit` `test:bundle`: client chunks have no `SERVER_ONLY_MARKER` and the server output does. The Island marker is in no entry chunk of `/islands` and is in a lazy chunk.
- `showcase` (Next) Playwright: the smoke test loads `/`, `/log`, `/graph` (BoardStore row) and `/errors` (MissingDependency, DependencyCycle, Computed). Further tests: create task (success, simulated failure, validation error), move and comment through the query cache, `/log` keeping component scope history across client navigation, and `/atoms` server HTML holding the seeded atom values while the seeded Effect atom never runs on the client (`prefetchAtoms` in a real Next render).
- `showcase-kit` Playwright: the same smoke, create, move/comment and `/log` tests, plus the server HTML holding a placeholder before the client fetches the board. On `/islands`, an Island keeps its server DOM, survives a wrapper re-render and hydrates on visible. The interaction trigger fires a pre-hydration click on a button exactly once, does not double-toggle a checkbox, and does not double-navigate or replay a link.
Still covered by unit tests in jsdom: Island triggers and replay (`packages/islands/src/__tests__/island.test.tsx`), `prefetchAtoms` (`packages/next/src/__tests__/atoms.test.ts`) and the devtools marker render (`packages/devtools`). No real-browser or production-bundle check remains for Next.js or Islands.

Follow-up: if branch protection requires the `e2e` CI check, remove it from the required checks, because the job no longer exists.

Tier: implementer opus at medium (actual_model: claude-opus-5-5)

baseline: green (pnpm turbo run test typecheck --filter=sleekstack --filter=@sleekstack/analyze --filter=docs --filter=showcase, pre-edit)

stage: impl-review - ran (codex fan-out, 3 draws SHIP, 0 findings, base master)
## Evidence
- Commits: 1c0aed932a384ad1b6e8c2f7c591f190bbfe84f2
- Tests: pnpm turbo run test typecheck, pnpm --filter docs build, pnpm --filter showcase check, pnpm --filter showcase build
- PRs: