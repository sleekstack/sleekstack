---
satisfies: [R9]
---
# fn-3-sleekstack-kit-effect-free-di-facade.4 apps/showcase-kit: full task-board port (domain, server, client, tests)

## Description
Port the whole fn-2 task board to kit only: domain, server and client, with the unit tests. **Blocked until PR #2 (fn-2 showcase) merges to master**; rebase onto master first so `apps/showcase` exists as the source.

**Size:** M
**Files:** apps/showcase-kit/{package.json,next.config.ts,tsconfig.json,vitest.config.ts,instrumentation.ts}, app/{layout,page,providers,error,log/page}.tsx, src/domain/**, src/server/**, src/client/**, src/__tests__/{requests.test.ts,board.test.tsx,no-effect.test.ts,renderStrict.tsx}, pnpm-lock.yaml
**Touches:** [apps/showcase-kit/**, pnpm-lock.yaml]

### Approach
- Port the domain tags (apps/showcase/src/domain/tags.ts) to `tag<T>()`, repos and infra to `layer()`, modules to `module({name,...})`, board actions to kit `action`, the client to kit/react. Same features as fn-2: demo-mode Shadowing, nested component scopes, the "break detail" boundary, the scope log.
- Keep UnitOfWork rollback via a request-lifetime Layer with withCleanup plus an explicit commit.
- no-effect.test: grep apps/showcase-kit/{app,src,instrumentation.ts} for `from 'effect'` or `@sleekstack/(core|next|react)` imports and expect none (non-vacuous: assert ≥1 file scanned).
- Mirror fn-2 tests: requests (20 concurrent calls, rollback, validation errors), board (StrictMode acquire/release, the error boundary, demo remount).

### Investigation targets
**Required:**
- apps/showcase/src/domain/*, src/server/*, src/client/*, app/providers.tsx (after the fn-2 merge)
- apps/showcase/src/__tests__/requests.test.ts, board.test.tsx

### Key context
- Client components import only tag files, never `*.server.ts`.
- ProjectView's useSyncExternalStore needs getServerSnapshot (fn-2 bug).
## Acceptance
- [ ] showcase-kit builds; create, move, comment, simulated failure and validation work in next dev
- [ ] requests and board tests pass; no-effect.test passes (non-vacuous)
- [ ] typecheck and test green
## Done summary
Ported the fn-2 task board to apps/showcase-kit using only @sleekstack/kit (tags, layers, modules, kit/next action/query, kit/react); requests/board/no-effect tests pass, next build green.

baseline: green
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 141d569733d3d0f5841ec80113d5ca8ffb424afc
- Tests: pnpm typecheck, pnpm test, next build (apps/showcase-kit), next start smoke: / and /log
- PRs: