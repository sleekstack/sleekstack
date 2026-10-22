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
- Build it on `serve` (`serverFn.ts:32-33`) with `StartOptions.controllers`; `serve` currently forces `router: noPages` (`:25-33`), which stays. Match the request URL against the entry's pattern first (a mismatch answers 404), skip middleware and server functions, and resolve to the HTTP face's `Response`, directory `wrap` chain included. <!-- Updated by plan-sync: fn-68-file-routed-controllers.5 shipped the `controllers` option (task 6 does not add it). It also means the 404 is not free: a path that matches no Controller falls through to the page, and `noPages`' `notFound` is `Effect.dieMessage`, so an unmatched URL would answer an empty 500 and reach `onError`. `matchController` (`packages/start/src/controller.ts`) is internal: `@sleekstack/start` exports only the four routing failures from that file, while `segments` and `bind` are public from `@sleekstack/router`. A malformed escape binds only at a param or splat position (R15) and never at a static one, so a pre-match must follow that rule or reuse the matcher -->
- A defect is an empty 500 and its cause goes to `onError`. `serve()` reconfigures the process-wide runtime per call, so these tests run serially.
- Model the typing on `callService` (`:112-126`); the entry comes from the discovered module and is passed in, never imported from the virtual module inside the package. <!-- Updated by plan-sync: fn-68-file-routed-controllers.8 generated the entries: they are plain `ControllerEntry` values in the `controllers` array of the module's default export (`DiscoveredApp`), found by `route`, not keyed by it. The route-name typing lives in the plugin's declaration, which the testing package cannot import: `Controllers` (route name to pattern) and `ControllerModules` (route name to `typeof import(...)` of the Controller module) are interfaces of `virtual:sleek/server-app` in the app's own `server.gen.d.ts`, so type `entry` as `ControllerEntry` (from `@sleekstack/start`) and leave route-name narrowing to the app's test. A generated entry carries a `Schema` only for the parts of the signature that declare them (an optional `params` or `query` is printed without its `undefined` member) and its `options` is the full chain, each `_defaults.ts` outer first, then the Controller, each element `{ file, wrap, bodyLimit, origins }` with `undefined` for an export the file lacks (`file` is project-relative). The `controller-app` fixture of `packages/ui-vite/src/__tests__/fixtures/` and its test "serves a generated entry through start()" show a real one (referenced Schema, codecs, a `_defaults.ts` `wrap` mapping decode failures to 422) -->

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

