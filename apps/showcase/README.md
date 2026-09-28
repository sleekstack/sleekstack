# SleekStack Showcase

A Next.js 15 (App Router) team task board built on `@sleekstack/core`, `@sleekstack/next` and
`@sleekstack/react`. It exercises modules, request scopes, component scopes, shadowing and the
dependency Graph end to end.

## What it shows

| Req | What | Files |
| --- | --- | --- |
| R1 | `service()` domain in modules that import each other (forward thunk, private service, `declareLayer`, bare Layer) | `src/domain/tags.ts`, `src/domain/*.server.ts`, `src/__tests__/graph.test.ts` |
| R2 | `/graph`: `snapshot(buildGraph(appEntries))` as a table, shadowed graph in demo mode | `app/graph/page.tsx` |
| R3 | `/errors`: each broken graph built lazily and in isolation | `src/errors/cases.server.ts`, `app/errors/page.tsx`, `src/__tests__/errors.test.ts` |
| R4 | `configureRuntime` once from `instrumentation.ts`, `onFinalizerError` sink | `instrumentation.ts`, `src/server/runtime.server.ts` |
| R5 | `query()` reads, `action()` writes, request-scoped RequestContext and UnitOfWork, `{ok:false, error}` results | `src/server/board.actions.ts`, `src/server/request.server.ts`, `app/page.tsx` |
| R6 | `/log`: request and component scope open/close, finalizer errors | `app/log/page.tsx`, `src/client/ScopeLog.tsx`, `src/domain/activity.server.ts` |
| R7 | Nested `LayerProvider`s app → project → task detail, async component services, error boundary per subtree | `app/providers.tsx`, `src/client/ProjectView.tsx`, `src/client/TaskDetail.tsx`, `src/client/component-services.ts`, `src/client/ErrorBoundary.tsx` |
| R8 | `<React.StrictMode>` with exactly one acquire/release per real mount | `app/providers.tsx`, `src/__tests__/board.test.tsx` |
| R9 | Demo mode shadows ActivityLog/Clock through `provide`, server and client | `src/server/demo.server.ts`, `src/domain/demo-cookie.ts`, `src/client/DemoToggle.tsx` |
| R10 | Client components import only Tags; marker absent from client chunks, present on the server | `src/domain/tags.ts`, `src/__tests__/bundle.test.ts` |
| R11 | Vitest (graph, errors, 20 concurrent actions, rollback, StrictMode) and a Playwright smoke against `next start` | `src/__tests__/*`, `e2e/smoke.spec.ts`, `playwright.config.ts` |

## Running

```bash
pnpm install                        # pnpm 11 (pinned in packageManager)
pnpm --filter showcase dev          # http://localhost:3000
pnpm --filter showcase typecheck
pnpm --filter showcase test         # Vitest (bundle test skips without a build)
pnpm --filter showcase build && pnpm --filter showcase test:bundle   # R10
pnpm --filter showcase exec playwright install chromium              # once
pnpm --filter showcase build && pnpm --filter showcase test:e2e      # R11 smoke, port 3100
```

## Known gaps

- The store is in memory at module scope: a restart resets it, and it is not shared across server instances.
- The session user is fake; there is no auth.
- Request-scope finalization is not stream-aware (a fn-1 gap): scopes close when the operation's result resolves.
- CSS is minimal.
