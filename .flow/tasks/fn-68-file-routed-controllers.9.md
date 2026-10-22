---
satisfies: [R13]
---
# fn-68-file-routed-controllers.9 testing: callController

Touches: [packages/testing/src/serverFn.ts, packages/testing/src/index.ts, packages/testing/src/__tests__/serverFn.test.ts]

## Description
Add `callController(entry, request, { layer, onError? })` beside `callHandler` (R13).

**Size:** S
**Files:** `packages/testing/src/serverFn.ts`, `packages/testing/src/index.ts`, `packages/testing/src/__tests__/serverFn.test.ts

### Approach
- Build it on `serve` (`serverFn.ts:32-33`) with the controllers option from task 6; `serve` currently forces `router: noPages` (`:25-33`), which stays. Match the request URL against the entry's pattern first (a mismatch answers 404), skip middleware and server functions, and resolve to the HTTP face's `Response`, directory `wrap` chain included.
- A defect is an empty 500 and its cause goes to `onError`. `serve()` reconfigures the process-wide runtime per call, so these tests run serially.
- Model the typing on `callService` (`:112-126`); the entry comes from the discovered module and is passed in, never imported from the virtual module inside the package.

### Investigation targets
**Required** (read before coding):
- `packages/testing/src/serverFn.ts:15-137`
- `packages/testing/src/__tests__/serverFn.test.ts:124-145`


## Acceptance
- [ ] a test with a referenced Schema checks parity with `start(...).fetch` for success, a decode failure and a `wrap`-mapped failure
- [ ] a URL that does not match the entry answers 404; a defect answers 500 and reaches `onError`
- [ ] TSDoc and an `api-coverage` entry exist for `callController`
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/testing` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

