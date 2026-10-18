---
satisfies: [R2, R3]
---
# fn-61-realworld-app-on-sleekstack.5 REST /api facade with in-process contract tests

Touches: apps/realworld/server/rest.ts, apps/realworld/server/app.ts, apps/realworld/test/rest*.test.ts, apps/realworld/README.md

## Description
One start `middleware` implementing every RealWorld route with its own method/path matcher: users, user, profiles (+follow), articles (+feed, favorite), comments, tags. It decodes requests with the same Schemas as the server functions, calls the same services, and maps tagged errors to 422/401/403/404 with `{errors:{body:[...]}}`. Auth by `Authorization: Token` only. Document the Newman command (fresh DB, `APIURL`) in the README and run it once manually.

**Size:** M
**Files:** `server/rest.ts`, `server/app.ts`, `test/rest.test.ts`, `README.md`

### Approach
- `handlers` are exact-path only (start.ts:78), so use `middleware` (middleware.ts:4); it must catch every error itself (start returns 500 otherwise).
- Envelopes: `{user}`, `{profile}`, `{article}`, `{articles,articlesCount}`, `{comment}`, `{comments}`, `{tags}`; user has `email,token,username,bio,image` (nullable bio/image); article fields per spec, ISO timestamps.
- Wrong login -> 403 key `email or password`.

### Investigation targets
**Required**:
- `packages/start/src/middleware.ts`, `packages/start/src/start.ts:78-90`
- RealWorld API docs (https://realworld-docs.netlify.app) and Postman collection

### Acceptance
- [ ] Contract tests per route: envelope shape, status codes, 401 bad token on optional routes, anonymous allowed, malformed JSON / missing envelope key -> 422, unknown route -> 404
- [ ] Newman collection passes on a fresh DB (recorded in the README); confirm the slug-on-title-change behavior against it and adjust spec if it expects stability

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
