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
Added the REST `/api` facade. `apps/realworld/server/rest.ts` is one start `middleware` with its own method and path matcher for all 19 RealWorld routes. It is mounted in `server/app.ts` (`middleware: [rest]`). It decodes the `{user}`/`{article}`/`{comment}` envelopes and the query strings with the same Schemas as the server functions, calls the same services, and catches every typed failure itself. Defects still reach start's 500 and `onError`.

- Auth uses `Authorization: Token <jwt>` only. Without the header the viewer is anonymous. A bad token, or another scheme such as `Bearer`, is 401 on every route, the optional-auth ones included.
- Error mapping: a ValidationError is 422 with its field errors. Malformed JSON is 422 `{body:['is not valid JSON']}`. A missing envelope key is 422 `{user:['is missing']}`. Unauthorized is 401 `{token:['is missing'|'is invalid']}`. Forbidden is 403 with its errors; a wrong login stays 403 `email or password`. NotFound is 404 `{<resource>:['not found']}`. An unknown `/api/` route or method, or a bad percent-encoding in a path parameter, is 404 `{body:['not found']}`. Register, create article and add comment answer 201. Deletes answer 204 with no body. The REST user envelope carries the token. List results include `body`.
- Tests: `test/rest.test.ts` has 11 cases covering envelopes and statuses per route, a bad or non-Token auth giving 401 on optional-auth routes, anonymous access allowed, 422 for malformed JSON and for a missing envelope key, 404 for an unknown route, non-numeric paging, and the title-change slug. Mutation checks each turned a test red: removing the 404 fallback, treating a non-Token scheme as anonymous, changing the 401 message, and changing register to 200.
- Outside Touches, for the conductor: `test/server.test.ts:143` now expects 200, not 404, for `/api/tags` through the dev middleware, because the facade answers it now. The review fix also edited `server/articles.ts` `withSlug`: `feed` is a reserved slug, so an article titled "Feed" gets `feed-2` on create and on title change. Without it, `GET /api/articles/feed` hid that article. A regression test is in rest.test.ts.
- Newman: upstream deleted the Postman collection in 2026; Hurl and Bruno replace it. I ran the classic collection pinned at `1fcad4a244` on a fresh DB: 32 requests, 311 assertions, 0 failed. The command is recorded in `apps/realworld/README.md`. The v2 collection (`365fa47`, Feb 2026) has 7 of 487 assertions failing. Each failure is a rule the spec decided differently and that the services already implement: duplicate user 409 vs the spec's 422, wrong login 401 `credentials:['invalid']` vs 403, duplicate title 409 vs the suffixed slug, and the forbidden message `forbidden` vs `is not yours`. Moving to v2 needs a spec/ADR decision.
- Slug on title change: neither collection changes a title, so neither tests slug stability. The spec's behavior stands: the slug is regenerated and the response carries the new one. No spec change was needed.
- Follow-up, not built: the facade has no request body size limit. start's `bodyLimit` covers only server functions, and its `readBody` is not exported.
- baseline: green via handoff (verified at ee7f9c2 by fn-61-realworld-app-on-sleekstack.4)
- GATE_SKIPPED:unittest:green-receipt d2b9b9ac - baseline reused from prior post-gate pass (the full gate ran green at d2b9b9a, 91 tests, before the receipt)
- Memory: bug/integration/generated-slugs-must-not-collide-with-2026-10-18
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out rid e0c6f2c584ac4384b332c37f6e91e0fa NEEDS_WORK (feed route shadowed a `feed` slug) -> fix d2b9b9a -> re-review SHIP)
## Evidence
- Commits: dc71cb54bf2e486a0f76812e61ad56e108a834bf, d2b9b9ac6c0deaa6dc06f7c8211cbaffe132fe7d
- Tests: pnpm turbo run test typecheck --filter=realworld, GATE_SKIPPED:unittest:green-receipt d2b9b9ac - baseline reused from prior post-gate pass, npx newman run Conduit.postman_collection.json (classic 1fcad4a, fresh DB): 311/311
- PRs: