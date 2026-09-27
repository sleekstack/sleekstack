---
satisfies: [R4, R5, R6, R9, R11]
---
# fn-2-showcase-app-team-task-board.2 Next runtime, request scopes, actions/queries, activity log, demo-mode server shadowing

## Description
Wire `@sleekstack/next`: instrumentation, request-scoped RequestContext and UnitOfWork, board queries and actions, the server side of the activity/finalizer log, and demo-mode shadowing on the server.

**Size:** M
**Files:** apps/showcase/instrumentation.ts, src/server/runtime.server.ts, src/server/request.server.ts (RequestContext, UnitOfWork), src/server/board.actions.ts ('use server'), src/server/demo.server.ts (cookie + mock entries), app/page.tsx (board read via query), app/log/page.tsx, app/error.tsx, src/__tests__/requests.test.ts
**Touches:** [apps/showcase/instrumentation.ts, apps/showcase/src/server/**, apps/showcase/app/page.tsx, apps/showcase/app/log/**, apps/showcase/app/error.tsx, apps/showcase/src/__tests__/requests.test.ts, apps/showcase/src/domain/**]

### Approach
- `instrumentation.ts`: `register()`, then an `if NEXT_RUNTIME==='nodejs'` check, then `await import('./src/server/runtime.server')`, which calls `configureRuntime({provide:[AppModule], onFinalizerError})`. Use one module-level config const, so a repeat call is the same-reference no-op.
- RequestContext is `lifetime:'request'`, with an id from IdGen and a fake user. UnitOfWork is a request-scoped `service` whose make uses acquireRelease/addFinalizer with the Exit: stage writes, commit on success, discard on failure. The Store applies staged writes atomically.
- Actions: `createTask(input, {simulateFailure})`, `moveTask`, `addComment`. They validate input (empty title, unknown id), then fail after staging when simulateFailure is set. Each passes `provide: demoEntries()` from the cookie.
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
- [ ] simulated failure: the promise rejects with the message and the store is unchanged; empty title and unknown id reject descriptively
- [ ] a throwing onFinalizerError sink doesn't change a successful result
- [ ] the log shows open and close per request id in order
- [ ] demo cookie: the action uses the mock, and /graph shows the shadowing row
- [ ] build succeeds (edge-safe instrumentation); typecheck and test green

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
