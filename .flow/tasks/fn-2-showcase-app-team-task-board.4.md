---
satisfies: [R10, R11, R12]
---
# fn-2-showcase-app-team-task-board.4 Bundle-split test, Playwright smoke, CI wiring, README docs

## Description
Finalization: prove the client/server split on Next's real build output, add a browser smoke test, include the showcase in CI, and document it.

**Size:** M
**Files:** apps/showcase/src/__tests__/bundle.test.ts, apps/showcase/e2e/smoke.spec.ts, apps/showcase/playwright.config.ts, apps/showcase/package.json (test:bundle, test:e2e), .github/workflows/ci.yml, apps/showcase/README.md, README.md
**Touches:** [apps/showcase/src/__tests__/bundle.test.ts, apps/showcase/e2e/**, apps/showcase/playwright.config.ts, apps/showcase/package.json, .github/workflows/ci.yml, apps/showcase/README.md, README.md, pnpm-lock.yaml]

### Approach
- bundle.test runs after `next build` (skip with a clear message if `.next` is missing; CI builds first). It reads `.next/static/chunks/**/*.js`, asserts SERVER_ONLY_MARKER is absent there, and that it is present under `.next/server/**`, which rules out a vacuous pass. Same logic as apps/playground/src/__tests__/bundle.test.ts, with none of the Vite mechanics.
- Playwright: a webServer running `next start`. Visit /, /graph, /errors and /log, create one task and assert it appears, then submit one simulated failure and one validation error (empty title) and assert their exact messages are displayed. This is the production check that expected errors travel as `{ok:false, error}` results and not as thrown messages that Next hides.
- CI: add `showcase` to the loop at .github/workflows/ci.yml:38 (resolve apps/ vs packages/ paths). Add a build step before the bundle test, plus an e2e job with a playwright browsers install.
- The README follows apps/playground/README.md: a table mapping R1–R11 to files, a Running section, Known gaps. Link it from the root README.md Current Status section (~line 117).

### Investigation targets
**Required:**
- apps/playground/src/__tests__/bundle.test.ts
- .github/workflows/ci.yml:30-43
- apps/playground/README.md
**Optional:**
- README.md:100-120

### Acceptance
- [ ] bundle test passes on a real build, and fails if a client component imports a *.server.ts (checked by temporary mutation)
- [ ] the Playwright smoke passes locally against `next start`, including the create success, the simulated-failure message and the validation-error message
- [ ] CI yml includes the showcase build, test, bundle and e2e steps
- [ ] the README map covers R1–R11; the root README links it
- [ ] `pnpm typecheck && pnpm test` green monorepo-wide

## Acceptance
- [ ] TBD

## Done summary
Added a Next build-output bundle-split test (R10, verified by mutation), a Playwright smoke against next start (pages, create, simulated failure, validation error), CI wiring (showcase in the script loop, build + test:bundle, e2e job), and apps/showcase/README.md with an R1-R11 map, linked from the root README.

stage: impl-review - ran (codex, SHIP first pass)
## Evidence
- Commits: 2ff9b8c5528a9a142e2fee27d016583cf43071c2
- Tests: pnpm typecheck && pnpm test, pnpm --filter showcase build && pnpm --filter showcase test:bundle, pnpm --filter showcase test:e2e, bundle mutation check: client import of infra.server (server-only removed) -> test:bundle fails
- PRs: