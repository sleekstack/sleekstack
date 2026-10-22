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
- `callService` (`serverFn.ts:112-126`) takes an entry and a Layer providing its Tag; the discovered app must expose the composed Layer and entries for a test to pass them in. Verify with a generated entry and a test Layer replacing the Tag, and with a hand-written entry as before.
- Document the pattern; no new public API unless a gap shows.

### Investigation targets
**Required** (read before coding):
- `packages/testing/src/serverFn.ts:85-137`
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
