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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
