---
satisfies: [R1, R9]
---
# fn-51-showcase-one-app-for-all-of-sleekstackui.1 Rename ui-demo to showcase, delete the old apps

## Description
git mv apps/ui-demo apps/showcase after deleting the Next.js apps/showcase and apps/showcase-kit; package name `showcase`; fix workspace/lockfile, tsconfig paths, turbo filters, ADR 0022 and other doc paths that name apps/ui-demo. **Touches:** apps/**, pnpm-lock.yaml, docs/adr/**, README.md

## Acceptance
- R1 and R9 hold: one `showcase` package (former ui-demo), turbo test/typecheck/size green
- No reference to `apps/ui-demo` remains outside .flow/

## Done summary
`apps/ui-demo` is now `apps/showcase` (git rename, all 74 files; package `showcase`, page title "SleekStack Showcase"), and the Next.js `apps/showcase` and `apps/showcase-kit` are deleted in their own commit, so `git log --follow` on the new app reaches ui-demo history. The lockfile drops both Next apps and the deps only they used. ADRs 0017/0022/0023/0029/0031/0037, the root README, `packages/{ui,analyze}/README.md` and `ui-devtools.mdx` now say `apps/showcase`. ADR 0022's publish gate item 1 now names the ui showcase.

Moved for task 2: the CLI check cases now use `packages/cli/src/__tests__/fixtures/kit-app` (kit-only Infra/Data/Activity/App graph, `--json --entry runtime.ts`) and `fixtures/effect-app` (Effect Layers on `@sleekstack/next`; `RequestLive`/`DemoLive` request and overrides roots, `prefetchQueries` adds no root; `--entry runtime.ts`). Both use the existing fixture convention (src/__tests__/fixtures, excluded from tsc/vitest/prettier), not `packages/cli/test/fixtures`. Their `check --json` graphs match the deleted apps' graphs (same nodes, lifetimes, owners, edges). Task 2 still owns: `.github/workflows/ci.yml` (showcase-kit steps, require-scripts list, showcase `test:bundle`/`test:e2e` that the Vite app lacks), AGENTS.md's export-name row (`apps/showcase-kit`), `showcases.mdx`, `guides.test.ts` allowed dirs, `islands.mdx`/`nextjs.mdx` page refs, README line 150 and `packages/kit/README.md` links, and the two analyzer fixture comments naming `apps/showcase/src/domain/live.server.ts`.

Local hazard: the git-excluded `apps/sleek-codes` is inside the `apps/*` workspace glob, so any `pnpm` run (including `pnpm exec`/`pnpm turbo`) re-adds an `apps/sleek-codes` importer to pnpm-lock.yaml. The committed lockfile was generated with that app excluded. Check `git diff pnpm-lock.yaml` before committing.

Tier: implementer opus at medium (actual_model: claude-opus-5-5)

baseline: green (turbo run test typecheck --filter=sleekstack --filter=ui-demo --filter=docs --filter=@sleekstack/analyze, pre-edit)

stage: impl-review - ran (codex fan-out, 3 draws SHIP, 0 findings, base master)
## Evidence
- Commits: 9274027f1bafec607b9bb91e6de13dbcca707678, 67d3057a43b791f915e8cfee47a3bfdcd7b9e4f2, 922d088decadbc49eadf5cf800a7b7dbfc4d47f2
- Tests: turbo run test typecheck (all 39 workspace tasks), turbo run test typecheck --filter=showcase --filter=sleekstack --filter=@sleekstack/analyze --filter=docs, apps/showcase: sleekstack check (exit 0, no diagnostics), prettier --check apps/showcase/src/pages/project.tsx apps/showcase/test/app.test.ts packages/cli/src/__tests__/check.test.ts
- PRs: