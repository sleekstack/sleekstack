# Showcase app: Team Task Board demonstrating every SleekStack feature

## Overview
A working Next.js 15 App Router app at `apps/showcase`: a small team task board with projects, tasks, comments and an activity/finalizer log. Every feature shipped in fn-1 is exercised in real code and made visible in the UI, so the app is both a demo and a living integration test. It depends on fn-1 (PR #1, unmerged), and this branch is cut from fn-1's branch.

## Quick commands
```bash
pnpm --filter showcase typecheck
pnpm --filter showcase test
pnpm --filter showcase build && pnpm --filter showcase test:bundle
pnpm --filter showcase dev   # manual: open http://localhost:3000
```

## Scope
- New workspace app `apps/showcase` (Next ^15.3, React 19.2, Effect 3.21), using `@sleekstack/core`, `@sleekstack/next` and `@sleekstack/react` through `workspace:*`.
- In-memory store, seeded with fixture data, living at module scope (it survives across requests; a dev restart resets it).
- The CI script-presence loop is updated to include the showcase.

## Boundaries / non-goals
- No real persistence, no real auth (a fake session user only), no deployment, and minimal CSS only.
- No new SleekStack library features. A library bug that blocks the demo may be fixed with a regression test. Any other gap goes into the README under "Known gaps".
- No streaming responses, no live push feed: the activity log is fetched with `query()` or refreshed after mutations.

## Decision context
- **Demo-mode toggle (R9):** a cookie read on the server. Server operations pass `provide: [MockX]` per call when it is set. On the client, a `key` derived from the mode remounts the app `LayerProvider`, because `provide` is captured at mount only (`packages/react/src/LayerProvider.tsx:133`). Rejected: mutating `provide` (ignored by design) and page reload only (hides the remount).
- **Failing action trigger (R5):** an explicit "Simulate failure" control on create-task. The inner `action()` fails after staging but before its explicit `uow.commit`, and the finalizer discards the uncommitted writes. Request scopes close with `Exit.void` (`action.ts:62`, `scope.ts:93`), so a finalizer can't use the Exit to decide. The exported Server Action returns a serializable `{ok:false, error}` result, because Next production hides thrown server messages. Unexpected defects still reach `error.tsx`, which uses Next 15's `reset()`.
- **Error gallery runners (R3):** async and isolated. The raw-Layer case builds the composed Layer in a scope, because `buildGraph` only composes and can't surface that failure.
- **instrumentation.ts (R4):** `register()` guards on `NEXT_RUNTIME === 'nodejs'` and dynamically imports the server-only runtime module, which calls `configureRuntime` once. The same config reference means no dev HMR double-build (fn-1 same-reference no-op).
- **Tests:** Vitest in the node environment for services, graph, errors and request scopes, calling `action`/`query` functions directly (20 concurrent calls; Next runs actions sequentially per client, so the UI can't prove concurrency). Vitest with jsdom plus `renderStrict` (copied from `packages/react/src/__tests__/renderStrict.tsx`) for client components. Async Server Components are covered by a Playwright smoke test only.
- **Bundle split (R10):** Tags live in `tags.ts`, implementations in `*.server.ts` with `import 'server-only'` and a `SERVER_ONLY_MARKER` constant. The test greps `.next/static/chunks/**` after `next build`: the marker must be absent there and present in the server output, the same non-vacuous sanity check as `apps/playground/src/__tests__/bundle.test.ts`. The Vite mechanics are not reused.
- **Runtime global slot:** tests that use `configureRuntime` share one process-global slot. They follow `packages/next/src/__tests__/next.test.ts:6-7` ordering, or keep them in one file.
- **Lifetimes:** project and task-detail scopes are both `component`. Nothing component-scoped may require a `request` service; the only rejection shown is the deliberate `CaptiveDependency` in `/errors`.

## Acceptance Criteria
- **R1:** The domain uses `service()` definitions (Store, TaskRepo, ProjectRepo, CommentRepo, ActivityLog, Clock, Logger, IdGen) in ≥3 modules that import each other, at least one through a forward-reference thunk. At least one module has a non-exported service. There is one `declareLayer` and one self-contained bare Layer (requirement type `never`). Errors: none at runtime; `buildGraph` of the app entries must succeed (tested).
- **R2:** `/graph` renders `snapshot(buildGraph(appEntries))`: nodes per Tag, edges, lifetime, owning module, private flag and shadowing, as an HTML table. In demo mode it renders the shadowed graph. Errors: no error surface beyond R1's build.
- **R3:** `/errors` builds each broken graph lazily and in isolation, so one failing case can't break the page, and shows the tagged error's `_tag` and message: `MissingDependency`, `DependencyCycle`, `CaptiveDependency`, `AmbiguousProvider` (equal precedence, not shadowing), `ModuleCycle`, `DuplicateModule`, `InvalidModule`, and the raw-Layer failure `Raw Layer in module "X" failed to build`. Errors: any case that fails to throw its expected tag renders "UNEXPECTED" and fails the test.
- **R4:** `configureRuntime` is called once from `instrumentation.ts` behind the nodejs guard. `onFinalizerError` appends to the activity log and logs. Errors: an edge runtime import must not break the build; a throwing sink must not change an operation's result (fn-1 contract, asserted).
- **R5:** Reads use `query()` and create, move and comment use `action()`. RequestContext (request id, fake user) and UnitOfWork are request-scoped: UnitOfWork commits on success and rolls back on failure. Errors: the simulated failure makes the inner operation reject, the store is unchanged, and the UI shows the returned `{ok:false, error}` message (verified in a production build by Playwright). An invalid input (empty title, unknown task id) returns a descriptive error.
- **R6:** A visible log (`/log` panel) shows ordered events: request scope open and close with the request id, component scope acquire and release with the scope name, and finalizer errors. Errors: no error surface beyond R4.
- **R7:** The board nests `LayerProvider`s app → project → task detail. The project scope has an async filter/selection store and the task-detail scope has an async draft editor, both consumed with `useService` under `Suspense`. Opening task detail mounts its provider with `key={taskId}`; closing it unmounts, and the log shows child-first release. Errors: a failing acquisition (demo "break detail" control) shows an error boundary for that subtree only, and sibling scopes stay mounted.
- **R8:** The app root uses `<React.StrictMode>`. The log and a test show exactly 1 acquire and 1 release per real mount. Errors: no error surface beyond R7.
- **R9:** A demo-mode toggle shadows the real ActivityLog or Clock with a mock through `provide` on both server and client, with no override API. The graph page shows the shadowing entry. Errors: toggling while a task detail is open remounts it without leaking a scope (the log shows the release).
- **R10:** Client components import only Tags from `tags.ts`. The bundle test proves the marker is absent from the client chunks and present on the server side. Errors: the test fails if the marker appears in the client, or if it isn't found anywhere (vacuous).
- **R11:** Vitest covers graph build, the error gallery cases, request isolation (20 concurrent `action` calls with distinct request ids and no cross-talk), rollback, and StrictMode acquire/release. A Playwright smoke test loads `/`, `/graph`, `/errors` and `/log` and does one create-task, one simulated failure and one validation error against `next start`, asserting the messages shown. `test` and `typecheck` scripts exist and CI runs them (the loop at `.github/workflows/ci.yml:38` includes the showcase). Errors: CI fails if the scripts are missing.
- **R12:** `apps/showcase/README.md` has a table mapping each R-ID (R1–R11) to its files, run instructions and a "Known gaps" section. It follows the layout of `apps/playground/README.md`. The root README "Current Status" section (around line 117) links to it. Errors: n/a.

## Early proof point
Task .1 proves the domain graph builds and snapshots under Next's toolchain (tsconfig, workspace imports, and `server-only`, which is Next-specific). If Next's bundler can't consume the workspace packages' `src/index.ts`, fix the package exports before .2.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | domain services and modules | .1 | — |
| R2 | graph explorer | .1 | — |
| R3 | error gallery | .1 | — |
| R4 | configureRuntime | .2 | — |
| R5 | request scopes, UnitOfWork | .2 | — |
| R6 | finalizer and activity log | .2, .3 | — |
| R7 | nested component scopes | .3 | — |
| R8 | StrictMode | .3 | — |
| R9 | shadowing demo mode | .2, .3 | — |
| R10 | bundle split | .4 | — |
| R11 | tests and CI | .1–.4 | — |
| R12 | docs | .4 | — |

## References
- Core API: `packages/core/src/index.ts:7-21`, `graph.ts:181-268`, `errors.ts`, `scope.ts:25-126`
- Next: `packages/next/src/runtime.ts:48-71`, `action.ts:87-96`, `__tests__/next.test.ts:74-86`
- React: `packages/react/src/LayerProvider.tsx:122-161`, `useService.ts:57-69`, `__tests__/renderStrict.tsx`
- Playground: `apps/playground/src/tags.ts`, `services.server.ts`, `api-example.tsx:34-48, 139-150`, `__tests__/bundle.test.ts`
- Next docs: instrumentation, use server, error.js (v15: reset), server-only
