---
satisfies: [R8, R9, R10]
---
# fn-3-sleekstack-kit-effect-free-di-facade.5 showcase-kit /graph, /errors, bundle + e2e; docs (README, ADR 0005, CONTEXT.md); CI

## Description
Finish the showcase-kit feature parity with fn-2 (the /graph and /errors pages, bundle split, Playwright smoke), then write the docs and wire CI.

**Size:** M
**Files:** apps/showcase-kit/app/{graph,errors}/page.tsx, src/errors/cases.server.ts, src/__tests__/{graph,errors,bundle}.test.ts, e2e/smoke.spec.ts, playwright.config.ts, package.json (test:bundle, test:e2e), README.md; packages/kit/README.md, docs/adr/0005-dependency-arrays-over-inject.md, CONTEXT.md, README.md, .github/workflows/ci.yml
**Touches:** [apps/showcase-kit/app/graph/**, apps/showcase-kit/app/errors/**, apps/showcase-kit/src/errors/**, apps/showcase-kit/src/__tests__/{graph,errors,bundle}.test.ts, apps/showcase-kit/e2e/**, apps/showcase-kit/playwright.config.ts, apps/showcase-kit/package.json, apps/showcase-kit/README.md, packages/kit/README.md, docs/adr/**, CONTEXT.md, README.md, .github/workflows/ci.yml]

### Approach
- /graph: render kit `snapshot(App)` (the same table as fn-2). /errors: every graph-error case built via the kit API, showing `SleekStackError.code` and message, isolated per case.
- The bundle test follows apps/showcase/src/__tests__/bundle.test.ts (SERVER_ONLY_MARKER absent from the client chunks, present on the server).
- The Playwright smoke follows apps/showcase/e2e/smoke.spec.ts, against `next start`.
- The showcase-kit README follows apps/showcase/README.md (R-ID map, a side-by-side note vs the Effect version).
- Docs: the kit README (API table, one example per subpath); ADR 0005 in the style of docs/adr/0004-*.md, rejecting Proxy, inject() and a param plugin; a `### Kit facade concepts` section in CONTEXT.md; the root README package list.
- CI: add `kit` to the loop at .github/workflows/ci.yml:36 and `showcase-kit` like showcase; a `build:types` step; showcase-kit build plus bundle test; e2e job coverage.

### Investigation targets
**Required:**
- apps/showcase/app/{graph,errors}/page.tsx, src/errors/cases.server.ts, e2e/smoke.spec.ts, src/__tests__/bundle.test.ts
- .github/workflows/ci.yml, docs/adr/0004-hybrid-service-definitions.md, CONTEXT.md

## Acceptance
- [ ] /graph and /errors render; errors.test covers every case (UNEXPECTED fails the test)
- [ ] bundle test passes on a real build (non-vacuous); Playwright smoke passes locally
- [ ] kit README, ADR 0005, CONTEXT.md, root README and showcase-kit README updated
- [ ] CI yml runs kit + showcase-kit test, typecheck, build:types, bundle and e2e
- [ ] `pnpm typecheck && pnpm test` green monorepo-wide


## Done summary
Added showcase-kit /graph and /errors pages (kit-only, 9 SleekStackError cases), bundle-split test with a server-only marker, Playwright smoke; wrote kit README, ADR 0005, CONTEXT.md kit section, root/showcase-kit READMEs, and CI steps for kit + showcase-kit (scripts, build:types, bundle, e2e). Baseline green; all gates green.

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 7e7460a2eee58428efdb7eada0a69014fc510438
- Tests: pnpm typecheck && pnpm test, pnpm --filter @sleekstack/kit build:types, pnpm --filter showcase-kit build && pnpm --filter showcase-kit test:bundle, pnpm --filter showcase-kit test:e2e
- PRs: