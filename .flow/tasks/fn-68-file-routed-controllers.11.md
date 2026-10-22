---
satisfies: [R14]
---
# fn-68-file-routed-controllers.11 realworld: migrate the remaining REST routes and delete rest.ts

Touches: [apps/realworld/server/**, apps/realworld/test/**, apps/realworld/README.md, apps/realworld/src/modules/**, apps/realworld/src/server.gen.d.ts]

## Description
Move every remaining RealWorld route to a Controller and delete the regex table (R14).

**Size:** M
**Files:** `apps/realworld/server/routes/api/**` (users, user, profiles, articles, feed, favorite, comments), `apps/realworld/server/rest.ts` (deleted), `apps/realworld/server/app.ts`, `apps/realworld/test/**`, `apps/realworld/README.md`

### Approach
- One Controller file per path from the `ROUTES` table (`rest.ts:65-118`): `users`, `users/login`, `user`, `profiles/[username]` and `/follow`, `articles`, `articles/feed`, `articles/[slug]` with `/favorite` and `/comments`, `comments/[id]`, using the same domain functions the table calls. <!-- Updated by plan-sync: fn-68-file-routed-controllers.10 already moved `tags`, `index` (`/api`) and `[...rest]` (`/api/*rest`) to Controllers, so 18 routes are left in `ROUTES`. The directory `wrap` is `apps/realworld/server/routes/api/_defaults.ts`, and every Controller added under `server/routes/api` inherits it: map no error in a Controller, and keep the wrap's written signature (`next: Effect<Response, Failure, Viewer>` to `Effect<Response, never, Db | TokenSecret>`) so `check` counts `Viewer` as provided. Its decode mapping keeps the keys `rest.ts` gave: an issue whose path starts at `params` is the 404, any other issue is 422 keyed by its path without the first element (`user.email` for `body`, `limit` for `query`), or `body` when nothing is left (malformed JSON, `is not valid JSON`). The `rest.ts` middleware runs before Controllers and now yields only for a request with no table entry, so delete each `ROUTES` row in the same step its Controller lands, or the Controller is unreachable and `rest.test.ts` passes against the table. Each Controller added rewrites `apps/realworld/src/server.gen.d.ts` (`Controllers`, `ControllerModules`, `isControllerPath`): commit it as written, never hand-edit it -->
- Annotate each method with written signatures; envelope bodies use `Schema.Schema.Type<typeof X>` at a nested position (`{ user: ... }`), with the existing domain Schemas (`NewUser`, `NewArticle`, `UpdateArticle`, `NewComment`, `LoginUser`, `UpdateUser`). Statuses 201 and 204 through `ResponseStatus.set` and `void`.
- `articles/feed` is a static Controller and beats `articles/[slug]` (memory `generated-slugs-must-not-collide`). The comment `id` param uses a Schema that fails on a non-numeric value, which `wrap` maps to the 404 the regex gave (`rest.ts:115`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 made `pnpm --filter realworld check` enforce these on every method: the keys of `params` must equal the path's params, so a method under `articles/[slug]` (including `favorite` and `comments`) declares `params: { slug }` even when it does not use it, or it is `ControllerParamsMismatch`; a referenced `params` or `query` Schema must encode to strings (`Schema.NumberFromString` for the comment id), or it is `ControllerMethodShape`; a method with no return annotation whose body returns a union of Effects is refused as `ControllerMethodShape` ("does not return an Effect"), so annotate it or return one Effect -->
- Delete `rest.ts` and its `middleware: [rest]` entry (`app.ts:28-35`), update the README (`:25-30`), and keep `SESSION` exported where tests import it.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/server/rest.ts:57-224`
- `apps/realworld/server/routes/api/_defaults.ts` - the directory `wrap` every Controller here inherits
- `apps/realworld/test/rest.test.ts` (the whole suite)
- `apps/realworld/server/app.ts:1-35`
- `apps/realworld/server/articles.ts`, `identity.ts`, `comments.ts` - the domain functions

**Optional**:
- `apps/realworld/test/server.test.ts:170-196` - dev middleware

## Acceptance
- [ ] `rest.ts` is deleted and no route table remains
- [ ] `rest.test.ts` passes with only the two size-limit header additions of the previous task, including the regression cases for unknown route, unsupported method, malformed escape, 413 (three ways), malformed JSON and bad token <!-- Updated by plan-sync: fn-68-file-routed-controllers.10 also added three tests to `rest.test.ts` (`/api/ itself is 404`; a bad token is 401 on an unknown route, method or escape; and a direct `wrap` test of the 415 and decode mappings, which imports `wrap` from `server/routes/api/_defaults`), and they stay. That direct test is the only coverage of the wrap's `ParseError`, 413 and 415 branches until this task's fetch tests (malformed JSON, missing envelope key, non-numeric comment id, 413) run them end to end. Two behaviours of task 10's Controllers that R14's list lacks: `OPTIONS` on a Controller path answers 204 with `Allow` (R9), and `/api` without a trailing slash answers the JSON 404 instead of the page router -->
- [ ] a non-numeric comment id answers the JSON 404; `/api/articles/` answers like `/api/articles` (R14 differences are asserted)
- [ ] `server.test.ts` and the page tests pass
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

