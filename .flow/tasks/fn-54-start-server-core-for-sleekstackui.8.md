---
satisfies: [R5]
---
# fn-54-start-server-core-for-sleekstackui.8 start: validate configured origins, settle CORS, tidy wire types

## Description
Follow-up from task .3's review (three minor findings). Make the `origins` option safe to use and say who owns CORS.

**Size:** S
**Files:** packages/start/src/origin.ts, start.ts, wire.ts; tests in packages/start/src/__tests__/; packages/start/README.md
**Touches:** [packages/start/src/**, packages/start/README.md]

### Approach
- Validate and normalize each `origins` entry at `start(...)`: an entry must be a bare origin (scheme, host, optional port); normalize case and drop a trailing slash; an invalid entry fails with a named error, never silently never matching.
- CORS: the framework sends no CORS headers; the app owns them through middleware. Prove the composition with a test: a middleware answers a preflight `OPTIONS` and adds the allow headers to a server-function response for a listed origin. Say so in the package README next to `origins`.
- Remove the duplicate `AnySchema` type alias in `wire.ts`.
- Equivalence pin: existing `start` tests pass unchanged.

### Investigation targets
**Required**:
- `packages/start/src/origin.ts`, `start.ts`, `wire.ts`
- `.flow/tmp/handover/fn-54.3.summary.md` (the three findings)
- `packages/start/src/__tests__/serverFn.test.ts` (origin cases)

## Acceptance
- [ ] An `origins` entry with a trailing slash or upper-case host matches the real `Origin` header; a malformed entry fails `start(...)` with a named error
- [ ] A test shows middleware handling a preflight and adding CORS headers for a listed origin; README documents that the app owns CORS
- [ ] One `AnySchema` alias in `wire.ts`; existing `start` tests pass
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
