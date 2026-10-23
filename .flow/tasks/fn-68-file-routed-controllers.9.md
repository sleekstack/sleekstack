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
- [ ] TSDoc exists for `callController` <!-- Conductor decision: the `api-coverage` entry is dropped; the docs API coverage test does not cover @sleekstack/testing, and adding it needs TSDoc on five older exports plus a generated page -->
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/testing` passes

## Done summary
`@sleekstack/testing` now exports `callController(entry, request, { layer, onError? })` (R13). One acceptance item changed by conductor decision: no `api-coverage` entry (see Decision below).

- `callController` (`packages/testing/src/serverFn.ts`) first matches the request URL against `entry.pattern` with router's `segments` and `bind`. It decodes segments the way start's `matchController` does: a malformed escape becomes a lone surrogate, so it binds only at a param or splat position and never at a static one. A URL that does not match answers an empty 404 without calling `start`. A match is served through `serve({ layer, onError, controllers: [entry] })`, so the HTTP face is start's own, including the `HEAD`, `OPTIONS` and 405 defaults, content type, `bodyLimit`, decode, the `wrap` chain and encode. `serve` keeps `router: noPages`. `entry` is typed `ControllerEntry`, and `onError` uses `StartOptions['onError']`, so an existing `ErrorSink` fits. TSDoc is written.
- Tests (`packages/testing/src/__tests__/serverFn.test.ts`, `describe('callController')`) use a hand-built entry shaped like a generated one: a referenced `Person` Schema (`NonEmptyString`) as `body`, a `params` and `success` Schema, and a `_defaults.ts` `wrap` that maps `Taken` to 409.
  - One parametrized test checks parity of status, content type and body with `start({ controllers: [entry], layer }).fetch` for success (200, extra field dropped), a decode failure (400 `DecodeError`) and a failure the `wrap` maps (409).
  - The other test covers the 404 for an unmatched URL and the defect: an empty 500 whose cause reaches `onError`.
- Red check: with the pre-match removed, the 404 assertion failed with "expected 500 to be 404" (`noPages` dies). The source was then restored.

Decision (conductor): the `api-coverage` test covers only `core`, `runtime`, `query`, `ui` and `start` (`PACKAGES` in `apps/docs/scripts/entry-points.mjs`), not `@sleekstack/testing`. Adding the package would also need TSDoc on five older testing exports and a generated API page, which is out of scope for this spec. The acceptance item is dropped; `callController` has TSDoc, and the testing guide page is covered by task 12.

Risk, not handled: in an app whose vitest config has the `serverServices()` plugin, `start` also loads the discovered Controllers and matches them before the given entry, so an earlier Controller matching the same URL would answer instead.

Gates (post-edit):
- `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld`: green, 28/28 tasks, testing 31 tests, run uncached. Receipt `.flow/tmp/green-receipts/e2026efe-unittest.json`.
- `pnpm --filter realworld check`: green before and after.
- Fixture graph check: the diff is empty.
- `pnpm --filter docs test`: green, 58 tests.
- prettier on the three files: clean.
- Baseline: green via receipt 0787cd81 (only `.flow/` changed since then).

GATE_SKIPPED:unittest:green-receipt 0787cd81 - baseline reused from prior post-gate pass

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - skipped(policy: the conductor folded the one downstream drift item into task 12 directly)
## Evidence
- Commits: e2026efef7a5a5873eaec0966e0b0a9ce3020984
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts) # before/after diff empty, pnpm --filter docs test, npx prettier --check packages/testing/src/serverFn.ts packages/testing/src/index.ts packages/testing/src/__tests__/serverFn.test.ts, GATE_SKIPPED:unittest:green-receipt 0787cd81 - baseline reused from prior post-gate pass
- PRs: