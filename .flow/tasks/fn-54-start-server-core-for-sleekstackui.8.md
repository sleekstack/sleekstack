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
`start(...)` now validates and normalizes each `origins` entry (`normalizeOrigin` in `origin.ts`). Case, a trailing slash and a default port are normalized, so `HTTPS://Allowed.TEST/` matches the `Origin: https://allowed.test` header. Anything that is not a bare origin throws the exported `InvalidOrigin` with the entry: a path, query, credentials, a bare host, `*`, `null`, and entries URL parsing would otherwise fold into a bare origin (dot segments, `%2e`, `https://@host`, whitespace). The raw syntax is checked before `URL` canonicalizes the entry.

CORS: the framework sends no CORS headers; the app owns them in middleware. `serverFn.test.ts` ("configured origins") proves the composition. A middleware answers a preflight `OPTIONS` with 204 and the allow headers without running the function, and sets `access-control-allow-origin` through `ResponseHeaders` on a server-function response. A third test shows no CORS header is sent without middleware. The new `packages/start/README.md` documents `origins` and CORS ownership with that middleware. `wire.ts` now imports `AnySchema` from `serverFn.ts` (exported there) instead of redeclaring it; `client.ts` keeps its own copy, untouched per task .4. Existing start tests pass unchanged.

baseline: green (`pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=showcase`)
stage: impl-review - ran (codex fan-out --base master: correctness and contracts NEEDS_WORK on one P2, validation after URL canonicalization accepted `/a/..`, `%2e`, `https://@host`; fixed in 6e182cd + 549ffbf; codex re-review SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: ca7567b48d1b8a04afb3f5f78f3042f6ca5a15c8, 6e182cd097b17fc9c7f0081bcba0f58949c858f1, 549ffbf8916761d79ddb74570295e286dbd8a3bd
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=showcase
- PRs: