# SleekStack Showcase

A Next.js 15 (App Router) team task board written in plain Effect (Layers, `Context.GenericTag`) on the `@sleekstack/next` runtime, plus
`@sleekstack/react` (`LayerProvider`, `useService`) and `@sleekstack/core` atoms. No SleekStack wrappers around Effect on the
server: no `declareLayer()`, `module()`, `action()` or `query()`.

## What it shows

| Req | What | Files |
| --- | --- | --- |
| R1 | Domain as plain Layers (`AppLive`): Infra, Store, repos, ActivityLog | `src/domain/tags.ts`, `src/domain/live.server.ts` |
| R4 | `configureRuntime({ layer: AppLive })` from `@sleekstack/next`; `runApp` is `runEffect` with a `RequestLive` request scope, `DemoLive` overrides, and defect reporting | `src/server/runtime.server.ts` |
| R2/R3 | `/graph` and `/errors` render the analyzer's prebuilt reports (`pnpm report`, run by predev/prebuild): the app root, and the broken plain-Layer fixtures | `app/graph/page.tsx`, `app/errors/page.tsx`, `src/server/report.server.ts`, `src/errors/graphs.ts` |
| R5 | Server Actions and page reads through `runApp`; request-scoped `Layer.scoped` RequestContext and UnitOfWork, `{ok:false, error}` results | `src/server/board.actions.ts`, `src/server/request.server.ts`, `app/page.tsx` |
| R6 | `/log`: request and component scope open/close, finalizer errors | `app/log/page.tsx`, `src/client/ScopeLog.tsx`, `src/domain/live.server.ts` |
| R7 | Nested `LayerProvider`s app → project → task detail, async component services, error boundary per subtree | `app/providers.tsx`, `src/client/ProjectView.tsx`, `src/client/TaskDetail.tsx`, `src/client/component-services.ts`, `src/client/ErrorBoundary.tsx` |
| R8 | `<React.StrictMode>` with exactly one acquire/release per real mount | `app/providers.tsx`, `src/__tests__/board.test.tsx` |
| R9 | Demo mode shadows ActivityLog/Clock on the server by passing `DemoLive` as `runEffect` overrides | `src/server/demo.server.ts`, `src/domain/demo-cookie.ts`, `src/client/DemoToggle.tsx` |
| R10 | Client components import only Tags; marker absent from client chunks, present on the server | `src/domain/tags.ts`, `src/__tests__/bundle.test.ts` |
| R11 | Vitest (20 concurrent actions, rollback, StrictMode) and a Playwright smoke against `next start` | `src/__tests__/*`, `e2e/smoke.spec.ts`, `playwright.config.ts` |

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

## Models: `fromDto` / `toDto`

Read and write shapes are not inverses, so there is no `toDto(model)`. They meet at the Model, through form state (the Draft):

```text
DTO(read) -fromDto(dto) [Effect, needs services]-> Model -create-> Draft -toDto-> DTO(write)
```

- `src/models/contracts.ts`: `ModelSpec` and `DraftSpec`.
- `src/models/task.ts`: `TaskModel` (`fromDto` is an Effect that resolves its own context from services such as `ProjectNames`; labels live in the Model), plus `NewTaskDraft` and `TaskCommentDraft`, one Draft per save boundary. Zod-first, no `z.coerce`, only `toDto` may read ambients.
- `src/client/useDraftForm.ts`: binds a Draft to react-hook-form; re-seeds on `src` change only while pristine. Pass a stable `src`.
- `src/models/task.server.ts`: `loadBoardModels`, an Effect that reads the repos and runs each DTO through `fromDto`; `ProjectNamesLive` builds the name lookup once per load, so N tasks share one read. `app/page.tsx` runs it with `runApp`, so the client only ever receives Models.
- `resolveDraft` / `submitDraft` (`contracts.ts`): resolve a Draft through Effect (validate, then run the Effect `toDto`, failing with `DraftInvalid`), then hand the wire body to the Server Action. `ProjectView` (new task) and `TaskDetail` (comment) submit this way, so a component never builds the wire body.
- Tests: `src/models/task.test.ts` (`fromDto`, `toDto`, defaults invariant) and `resolve.test.ts` (`resolveDraft`, `submitDraft`, `loadBoardModels`).
