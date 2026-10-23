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
- `callService` (`serverFn.ts:110-128`) takes an entry and a Layer providing its Tag; the discovered app must expose the composed Layer and entries for a test to pass them in. Verify with a generated entry and a test Layer replacing the Tag, and with a hand-written entry as before. <!-- Updated by plan-sync: fn-68-file-routed-controllers.9: `callController` (`serverFn.ts:151-165`) is the precedent, built on `serve` (`:33-35`, `start({ router: noPages, ...options }).fetch(request)`). It left a known risk: in an app whose Vitest config has the `serverServices()` plugin, `start` also loads the discovered app and merges it into the explicit options. Once the discovered app carries a composed Layer (Layer Files such as realworld's `DbLive(process.env.CONDUIT_DB)`), generated `services` and the Server Root's `onError`, every `callService`, `callServerFn` and `callHandler` test in such an app would build the Layer Files and could take the Server Root's `onError`. Verify and test that the test `layer` shadows the discovered Layer, that an explicit `onError` wins (`post` passes one to capture defects, `serverFn.ts:69`), and that the explicit `services: [entry]` registers once beside the discovered entry. The generated entries are already available to a test as `virtual:sleek/server-registry` (`services.find((s) => s.tag === Tally)`, as showcase's `server.test.ts` does); the implementation Layer is what the discovered app adds -->

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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
