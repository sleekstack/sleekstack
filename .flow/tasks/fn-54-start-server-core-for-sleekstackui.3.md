---
satisfies: [R3, R4, R5, R9]
---
# fn-54-start-server-core-for-sleekstackui.3 start: serverFn declaration, wire protocol and security checks

## Description
Add `serverFn` and its endpoint: declaration (id, input Schema, success Schema, optional tagged-error Schema, generator body), the POST wire format, Schema decode and encode at the boundary, the Exit-shaped response, the same-origin check, and the control-flow envelope. Replaces task 2's `functions` placeholder.

**Size:** M
**Files:** new packages/start/src/serverFn.ts, wire.ts, origin.ts; edit start.ts; tests under packages/start/src/__tests__/
**Touches:** [packages/start/src/**]

### Approach
- The body runs through the same request-scope path as task 2; requirements resolve from the Request Scope.
- Response shape (fixed, no extra fields): `{ _tag: 'Success', value }`, `{ _tag: 'Failure', error }`, `{ _tag: 'Redirect', to }`, `{ _tag: 'NotFound' }`; 400 body carries a `DecodeError` with field-level issues; defects are an opaque 500.
- Duplicate or malformed ids fail at `start(...)` with a named error (follow the repo's named-error style).
- Request body limit with a configurable default; 413 above it.
- Origin check runs before decoding: same-origin passes, listed `origins` pass, else 403; a missing `Origin` on a non-same-site request is rejected.
- Redirect and NotFound are the router's own errors (R9); bound redirect loops as the router does.

### Investigation targets
**Required**:
- `packages/router/src/resolve.ts` (`Redirect`, `NotFound`, `controlOf`, `MAX_REDIRECTS`)
- `packages/kit/src/next/action.ts` (settle and defect handling to mirror, not copy)
- `packages/runtime/src/runtime.ts` (`runEffect`)
- `docs/adr/0033-*.md` (Schema decoding of FormData)
**Optional**:
- `docs/proposals/start-framework.md` sections 5 and 10

## Acceptance
- [ ] Round trip tests: success, declared typed failure, undeclared failure, defect (opaque 500), decode failure (400, body not run)
- [ ] Output is encoded with the success Schema: a field outside it is not serialized (test)
- [ ] 405 for non-POST, 404 for an unknown id without listing ids, 400 for malformed JSON, 413 over the limit, 403 cross-origin, allowed origin passes
- [ ] Duplicate id and invalid id characters fail at `start(...)` with a named error
- [ ] Redirect and NotFound from a function answer 302/404 on the wire and are the router's own values on decode
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` is green

## Done summary
`serverFn(id, { input, success, error? })(function* (input) {...})` declares a server function. It is directly callable with decoded input. Its body may fail only with the declared error or the router's `Redirect` / `NotFound`, which is a type error otherwise (`layer.test-d.ts`). `start({ functions, origins, bodyLimit })` serves the functions at `POST /_sleek/fn/<id>` and replaces task 2's placeholder. The stage runs in this order:
- 405 with `Allow: POST`
- origin check, 403 (`origin.ts`): the request's own origin and the listed `origins` pass; with no `Origin` header only `Sec-Fetch-Site: same-origin` passes
- unknown id, empty 404
- streamed body over the limit (default 1 MiB), 413
- malformed JSON, 400 `DecodeError`
- input Schema, 400 `DecodeError` with field-level `issues`; the body is not run

Envelopes (`wire.ts`), with no extra fields:
- `{_tag:'Success', value}`: 200, encoded with the success Schema, so extra fields are dropped
- `{_tag:'Failure', error}`: 200, for the declared error
- `{_tag:'Redirect', to}`: 302 with no `Location`, so `fetch` does not follow it
- `{_tag:'NotFound'}`: 404
- an undeclared failure or a defect: the error sink, then an empty 500

`decodeResult(fn, body)` reads an envelope back as the success value, the declared error, the router's own `Redirect` / `NotFound`, or `DecodeError`; an unknown envelope is a `DecodeError`. Task 4's client stub can use it. It and `prefix` are internal exports of `wire.ts`, not the package index. Duplicate ids fail at `start(...)` with `DuplicateServerFn`, and ids outside `[A-Za-z0-9][A-Za-z0-9_.-]*` with `InvalidServerFnId`, before the runtime is configured. Tests: `packages/start/src/__tests__/serverFn.test.ts` covers every AC and error case.

Notes:
- Redirect loops: the server answers one hop; the client side bounds them through the router's own `MAX_REDIRECTS` once the stub navigates (task 4).
- A `Schema.Void` function round-trips: an empty request body is `undefined` input, and a `Success` envelope without `value` decodes as `undefined` (review finding, fixed in e248511).

baseline: green (`pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=showcase`)
stage: impl-review - ran (codex fan-out hung twice and was killed; its correctness draw's P1, the void round trip, was fixed in e248511. Claude CLI backend, user-approved and recorded on the receipt as same-family, then returned SHIP)
Follow-ups from the SHIP review (P3, not fixed):
- validate `origins` entries at `start(...)` (a trailing slash never matches)
- remove the second `AnySchema` alias in wire.ts
- emit CORS headers for listed origins, or document that the app owns them
Tier: implementer opus at medium
## Evidence
- Commits: 3194e85c30f43df75abcc8a6fd0bc2d889416196, e24851163168d543188ab0decb028b4ec79e1c8a
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=showcase
- PRs: