---
satisfies: [R4, R5, R6, R9, R11]
---
# fn-2-showcase-app-team-task-board.2 Next runtime, request scopes, actions/queries, activity log, demo-mode server shadowing

## Description
Wire `@sleekstack/next`: instrumentation, request-scoped RequestContext and UnitOfWork, board queries and actions, the server side of the activity/finalizer log, and demo-mode shadowing on the server.

**Size:** M
**Files:** apps/showcase/app/graph/page.tsx (demo-mode shadowing), apps/showcase/instrumentation.ts, src/server/runtime.server.ts, src/server/request.server.ts (RequestContext, UnitOfWork), src/server/board.actions.ts ('use server'), src/server/demo.server.ts (cookie + mock entries), app/page.tsx (board read via query), app/log/page.tsx, app/error.tsx, src/__tests__/requests.test.ts
**Touches:** [apps/showcase/app/graph/**, apps/showcase/instrumentation.ts, apps/showcase/src/server/**, apps/showcase/app/page.tsx, apps/showcase/app/log/**, apps/showcase/app/error.tsx, apps/showcase/src/__tests__/requests.test.ts, apps/showcase/src/domain/**]

### Approach
- `instrumentation.ts`: `register()`, then an `if NEXT_RUNTIME==='nodejs'` check, then `await import('./src/server/runtime.server')`, which calls `configureRuntime({provide:[AppModule], onFinalizerError})`. Use one module-level config const, so a repeat call is the same-reference no-op.
- RequestContext is `lifetime:'request'`, with an id from IdGen and a fake user. UnitOfWork is a request-scoped `service` that stages writes. Each operation body ends with an explicit `yield* uow.commit` as its last step, and the Store applies the staged writes atomically. The scope finalizer only discards uncommitted staged work. Don't rely on the close Exit: `action.ts:62` and `scope.ts:93` close request scopes with `Exit.void`, so a finalizer can't tell success from failure. No library change is needed.
- Two layers:
  - Inner operations use `action(...)` from @sleekstack/next. They validate input (empty title, unknown id), and when simulateFailure is set they fail after staging but before commit, so the operation rejects. Each passes `provide: demoEntries()` from the cookie.
  - The exported Server Actions ('use server', `createTask`/`moveTask`/`addComment`) await the inner operation and return a serializable `{ ok: true, data } | { ok: false, error: string }`. Next production hides thrown server messages, so expected failures must be returned, not thrown. Unexpected defects still throw into error.tsx.
- ActivityLog records request open (in the RequestContext make) and close (a finalizer). `/log` reads it via `query()`.
- error.tsx uses Next 15 `reset()`.

### Investigation targets
**Required:**
- packages/next/src/runtime.ts:48-71, action.ts:40-96
- packages/next/src/__tests__/next.test.ts:6-7, 74-86 (global slot ordering, concurrency pattern)
**Optional:**
- packages/core/src/scope.ts (finalizer order, onFinalizerError)

### Key context
- No streams from action/query: they are rejected.
- The runtime slot is process-global with no reset, so keep all runtime tests in requests.test.ts and put the unconfigured case first.
- Nothing component-scoped may depend on request services.

### Acceptance
- [ ] requests.test: 20 concurrent `createTask` calls get distinct request ids and all commit
- [ ] simulated failure: the inner operation rejects, the store is unchanged, and the Server Action returns `{ok:false, error}` with the message; empty title and unknown id return descriptive errors
- [ ] a success commits exactly once; a failure after staging leaves no partial write
- [ ] a throwing onFinalizerError sink doesn't change a successful result
- [ ] the log shows open and close per request id in order
- [ ] demo cookie: the action uses the mock, and /graph shows the shadowing row
- [ ] build succeeds (edge-safe instrumentation); typecheck and test green

## Acceptance
- [ ] TBD

## Done summary
Wired @sleekstack/next into the showcase app: instrumentation.ts (nodejs-guarded, single configureRuntime call with an onFinalizerError sink that logs and records to ActivityLog), request-scoped RequestContext (id + fake user, logs request open/close) and UnitOfWork (stages writes, committed explicitly last so a validation/simulated failure leaves the Store untouched), the createTask/moveTask/addComment Server Actions returning {ok,data}|{ok,error}, cookie-driven demo-mode shadowing of ActivityLog/Clock applied consistently across board.actions.ts, app/page.tsx, app/log/page.tsx and app/graph/page.tsx, and a Next 15 error.tsx boundary. requests.test.ts covers 20-concurrent request isolation (distinct ids, matched open/close, no cross-talk), validation/simulated-failure rollback, commit-once, finalizer-sink safety, ordered log entries, and demo shadowing. typecheck/test/build all green.

stage: impl-review - ran [NEEDS_WORK -> SHIP] (3 findings: P1 toResult swallowing unexpected defects instead of letting them reach error.tsx, fixed via a tagged ExpectedFailure; P2 /graph using a ?demo= query param instead of the same cookie as demoEntries(), fixed; P2 concurrency test asserting distinct task ids instead of distinct request ids, fixed to assert 20 matched open/close request-id pairs)
## Evidence
- Commits: 33c96c390e373471340ffd09e8a84caffa8144b5, c004615b0406befd4649b750b69038640445face
- Tests: pnpm --filter showcase typecheck, pnpm --filter showcase test, pnpm --filter showcase build
- PRs: