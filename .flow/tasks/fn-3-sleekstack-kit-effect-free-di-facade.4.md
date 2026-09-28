---
satisfies: [R9, R10]
---
# fn-3-sleekstack-kit-effect-free-di-facade.4 apps/showcase-kit port + docs (README, ADR 0005, CONTEXT.md) + CI wiring

## Description
Port the fn-2 task board to kit only, and finalize the docs and CI. **Blocked until PR #2 (fn-2 showcase) merges to master**; rebase onto master first so `apps/showcase` exists as the source.

**Size:** M
**Files:** apps/showcase-kit/** (package.json, next.config.ts, instrumentation.ts, app/**, src/domain/**, src/server/**, src/client/**, src/__tests__/{requests,board,no-effect}.test.ts(x)), packages/kit/README.md, docs/adr/0005-dependency-arrays-over-inject.md, CONTEXT.md, README.md, .github/workflows/ci.yml, pnpm-lock.yaml
**Touches:** [apps/showcase-kit/**, packages/kit/README.md, docs/adr/**, CONTEXT.md, README.md, .github/workflows/ci.yml, pnpm-lock.yaml]

### Approach
- Port domain tags (apps/showcase/src/domain/tags.ts) to `tag<T>()`, repos and infra to `layer()`, modules to `module({name,...})`, board actions to kit `action`, the client to kit/react. Keep UnitOfWork rollback via a request-lifetime Layer with withCleanup plus an explicit commit.
- Scope: the core board flows (create, move and comment, simulated failure, task detail scope). Skip the /errors gallery and the Playwright suite; note that in the README as a known gap.
- no-effect.test: grep apps/showcase-kit/{app,src} for `from 'effect'` or `@sleekstack/(core|next|react)` imports and expect none.
- Mirror fn-2 tests: requests (20 concurrent calls, rollback), board (StrictMode acquire and release).
- Docs: the kit README (API table, one example per subpath); ADR 0005 in the style of docs/adr/0004-*.md, rejecting Proxy, inject() and a param plugin; a `### Kit facade concepts` section in CONTEXT.md; the root README package list.
- CI: add `kit` to the loop at .github/workflows/ci.yml:36 (it's under packages/) and `showcase-kit` like showcase; add a `pnpm --filter @sleekstack/kit build:types` step before the tests.

### Investigation targets
**Required:**
- apps/showcase/src/domain/*, src/server/*, src/client/* (after the fn-2 merge)
- apps/showcase/src/__tests__/requests.test.ts, board.test.tsx
- .github/workflows/ci.yml, docs/adr/0004-hybrid-service-definitions.md, CONTEXT.md

### Key context
- Client components import only tag files, never `*.server.ts`.

## Acceptance
- [ ] showcase-kit builds; create/move/comment and simulated failure work in next dev
- [ ] requests + StrictMode tests pass; no-effect.test passes
- [ ] README, ADR 0005, CONTEXT.md and root README updated
- [ ] CI yml runs kit + showcase-kit test, typecheck and build:types
- [ ] `pnpm typecheck && pnpm test` green monorepo-wide

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
