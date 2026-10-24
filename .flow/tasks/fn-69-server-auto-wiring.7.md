---
satisfies: [R8]
---
# fn-69-server-auto-wiring.7 testing: callService over generated services

Touches: [packages/testing/src/serverFn.ts, packages/testing/src/__tests__/serverFn.test.ts, apps/docs/content/docs/testing.mdx]

## Description
Make `callService` work over generated registry entries with the discovered Layer, and keep it unchanged for hand-written ones (R8).

**Size:** S
**Files:** `packages/testing/src/serverFn.ts`, `packages/testing/src/__tests__/serverFn.test.ts`, `apps/docs/content/docs/testing.mdx`

### Approach
- `callService` (`serverFn.ts:110-128`) takes an entry and a Layer providing its Tag; the discovered app must expose the composed Layer and entries for a test to pass them in. Verify with a generated entry and a test Layer replacing the Tag, and with a hand-written entry as before. <!-- Updated by plan-sync: fn-68-file-routed-controllers.9: `callController` (`serverFn.ts:151-165`) is the precedent, built on `serve` (`:33-35`, `start({ router: noPages, ...options }).fetch(request)`). It left a known risk: in an app whose Vitest config has the `serverServices()` plugin, `start` also loads the discovered app and merges it into the explicit options. Once the discovered app carries a composed Layer (Layer Files such as realworld's `DbLive(process.env.CONDUIT_DB)`), generated `services` and the Server Root's `onError`, every `callService`, `callServerFn` and `callHandler` test in such an app would build the Layer Files and could take the Server Root's `onError`. Verify and test that the test `layer` shadows the discovered Layer, that an explicit `onError` wins (`post` passes one to capture defects, `serverFn.ts:69`), and that the explicit `services: [entry]` registers once beside the discovered entry. The generated entries are already available to a test as `virtual:sleek/server-registry` (`services.find((s) => s.tag === Tally)`, as showcase's `server.test.ts` does); the implementation Layer is what the discovered app adds --> <!-- Updated by plan-sync: fn-69-server-auto-wiring.6 emitted `layer` (the Layer Files folded in composition order, behind a memoized getter, built on the first request) and `onError` (only when `_app.ts` exists) on the default export of `virtual:sleek/server-app`; with no Layer File and no `_app.ts` both are absent, so a test's explicit `layer` and `onError` need no shadowing there -->

- Document the pattern; no new public API unless a gap shows.

### Investigation targets
**Required** (read before coding):
- `packages/testing/src/serverFn.ts:33-35,54-85,110-165` - `serve`, `post`, `callService`, `callController`
- `packages/testing/src/__tests__/serverFn.test.ts`

**Optional**:
- `apps/showcase/test/server.test.ts:102-121` - the `services.find` pattern

## Acceptance
- [ ] `callService` over a generated RPC File entry and over a Manifest entry works with a test Layer
- [ ] the hand-written case is unchanged
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/testing` passes

## Done summary
`callService` already works over generated registry entries with no API change. New tests in `packages/testing/src/__tests__/serverFn.test.ts` mock start's discovered app (a Layer File, an RPC File service, an RPC Manifest service, the Server Root's `onError`). They pin four things: a test layer replaces the generated Tag; the Layer Files are still built under it; a defect returns as the Exit cause and never reaches the Server Root's `onError`; the explicit entry registers once beside the discovered one. The hand-written entry is unchanged. `apps/docs/content/docs/testing.mdx` documents the pattern. `serverFn.ts` is untouched because no gap showed.

Follow-up risk: Layer Files such as realworld's `DbLive` are still built in `callService` tests in an app with the plugin. Changing that would need a `start` option, which is out of this task's Touches.

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - skipped(policy: the conductor folded the one downstream drift item into task 11 directly)
## Evidence
- Commits: 6b3e6d00adc3492b9208b6152ca3b8e21530699b
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld --filter=showcase --force, pnpm --filter realworld check, pnpm turbo run test typecheck build --filter=docs --concurrency=1 --force, pnpm --filter docs test, pnpm --filter docs build, pnpm format:check
- PRs: