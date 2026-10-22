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
Realworld's whole REST facade now runs on Controllers under `apps/realworld/server/routes/api`, and `server/rest.ts` and its `middleware: [rest]` entry are deleted, so no route table remains (R14).

- There is one Controller per path from the old `ROUTES` table:
  - `users`, `users/login`, `user`
  - `profiles/[username]` and `profiles/[username]/follow`
  - `articles` and the static `articles/feed`, which wins over `[slug]`
  - `articles/[slug]`, with `/favorite`, `/comments` and `/comments/[id]` under it
- Every method has a written signature and calls the same domain function the table called.
  - Envelope bodies and answers are written as `Schema.Schema.Type<typeof X>` at a nested position, using `NewUser`, `LoginUser`, `UpdateUser`, `NewArticle`, `UpdateArticle`, `NewComment`, `User`, `Profile`, `Article`, `ArticleList` and `Comment`.
  - Register, create article and add comment answer 201 through `ResponseStatus.set(201)`. The two deletes return `void`, so they answer 204.
- The comment `id` is written as a plain `number` param. A non-numeric id fails the `params` decode, and the directory `wrap` turns that into the JSON 404.
- `articles` and `articles/feed` take query values as written optional strings. The domain `Page` Schema accepts strings, so a non-numeric `limit` is still the service's 422.
- `src/server.gen.d.ts` is committed exactly as the plugin regenerated it, with 12 new Controllers.
- The README's REST bullet now describes the Controllers and the directory `wrap`. The status table gains 413 and 415 rows, and the 404 row now covers a non-numeric comment id.

Tests (`test/rest.test.ts`):
- None of the existing 15 tests was edited. All of them passed against the Controllers as soon as `rest.ts` was deleted, including the earlier task's tests.
- New: `a body without application/json is 415`, which reaches the 415 through `fetch`.
- New: `a non-numeric comment id is the JSON 404`. A mutation check (id typed `string`) turned it red with a 401 instead of the 404, and the code was then restored.
- New: `/api/articles/ answers like /api/articles; /api//x reaches the pages`, covering the two R14 intended differences that had no test yet.

Behaviour differences beyond R14's list:
- A numeric but non-integer or negative comment id (`1.5`, `-1`) now decodes and reaches `deleteComment`. It answers 404 `{comment: ['not found']}`, where the regex gave 404 `{body: ['not found']}`. It is still a 404.

Follow-ups (not built):
- The return-annotation check refuses an Effect return type written through a type alias of the same file (`type Answer = Effect.Effect<...>`) with `ControllerMethodShape: does not return an Effect.Effect<A, E>`. It reads `ret.aliasSymbol`, while the Schema reader unaliases. An alias of the success object works, and the Controllers here use that.
- `docs/adr/0053` still names `server/rest.ts` as the workaround it replaced. That is history; the docs work belongs to task 12.

Gates:
- Baseline was green through gate receipt db02a6dd (only `.flow/` had changed since), and `pnpm --filter realworld check` exited 0.
- `GATE_SKIPPED:unittest:green-receipt db02a6dd - baseline reused from prior post-gate pass`
- Post-edit Quick command: green, 28/28 tasks, realworld 161 tests (158 before). Receipt `.flow/tmp/green-receipts/0787cd81-unittest.json`.
- `pnpm --filter realworld check`: exit 0. A probe with a mismatched params key failed with `ControllerParamsMismatch`, so `check` reads the new files.
- `pnpm --filter docs test`: 58/58.
- `pnpm --filter realworld build`: exit 0. The client build excludes the Controllers.
- `prettier --check apps/realworld`: clean.
- Fixture graph check: not run, because no public export changed.

Untracked `.flow/specs/fn-70-served-records.*` and `.flow/tasks/fn-70-served-records.*` files appeared from another session during the run. They were left out of every commit through the conductor's pathspec exclusion.

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - ran (sonnet; updated task 12)
## Evidence
- Commits: 0787cd811e8d8889413c231518c87515fc60b1f5
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, pnpm --filter docs test, pnpm --filter realworld build, GATE_SKIPPED:unittest:green-receipt db02a6dd - baseline reused from prior post-gate pass
- PRs: