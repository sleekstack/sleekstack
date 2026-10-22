---
satisfies: [R14]
---
# fn-68-file-routed-controllers.11 realworld: migrate the remaining REST routes and delete rest.ts

Touches: [apps/realworld/server/**, apps/realworld/test/**, apps/realworld/README.md, apps/realworld/src/modules/**]

## Description
Move every remaining RealWorld route to a Controller and delete the regex table (R14).

**Size:** M
**Files:** `apps/realworld/server/routes/api/**` (users, user, profiles, articles, feed, favorite, comments), `apps/realworld/server/rest.ts` (deleted), `apps/realworld/server/app.ts`, `apps/realworld/test/**`, `apps/realworld/README.md`

### Approach
- One Controller file per path from the `ROUTES` table (`rest.ts:66-120`): `users`, `users/login`, `user`, `profiles/[username]` and `/follow`, `articles`, `articles/feed`, `articles/[slug]` with `/favorite` and `/comments`, `comments/[id]`, using the same domain functions the table calls.
- Annotate each method with written signatures; envelope bodies use `Schema.Schema.Type<typeof X>` at a nested position (`{ user: ... }`), with the existing domain Schemas (`NewUser`, `NewArticle`, `UpdateArticle`, `NewComment`, `LoginUser`, `UpdateUser`). Statuses 201 and 204 through `ResponseStatus.set` and `void`.
- `articles/feed` is a static Controller and beats `articles/[slug]` (memory `generated-slugs-must-not-collide`). The comment `id` param uses a Schema that fails on a non-numeric value, which `wrap` maps to the 404 the regex gave (`rest.ts:116`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 made `pnpm --filter realworld check` enforce these on every method: the keys of `params` must equal the path's params, so a method under `articles/[slug]` (including `favorite` and `comments`) declares `params: { slug }` even when it does not use it, or it is `ControllerParamsMismatch`; a referenced `params` or `query` Schema must encode to strings (`Schema.NumberFromString` for the comment id), or it is `ControllerMethodShape`; a method with no return annotation whose body returns a union of Effects is refused as `ControllerMethodShape` ("does not return an Effect"), so annotate it or return one Effect -->
- Delete `rest.ts` and its `middleware: [rest]` entry (`app.ts:28-35`), update the README (`:25-30`), and keep `SESSION` exported where tests import it.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/server/rest.ts:58-226`
- `apps/realworld/test/rest.test.ts` (the whole suite)
- `apps/realworld/server/app.ts:1-35`
- `apps/realworld/server/articles.ts`, `identity.ts`, `comments.ts` - the domain functions

**Optional**:
- `apps/realworld/test/server.test.ts:170-196` - dev middleware

## Acceptance
- [ ] `rest.ts` is deleted and no route table remains
- [ ] `rest.test.ts` passes with only the two size-limit header additions of the previous task, including the regression cases for unknown route, unsupported method, malformed escape, 413 (three ways), malformed JSON and bad token
- [ ] a non-numeric comment id answers the JSON 404; `/api/articles/` answers like `/api/articles` (R14 differences are asserted)
- [ ] `server.test.ts` and the page tests pass
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

