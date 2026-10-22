---
satisfies: [R14]
---
# fn-68-file-routed-controllers.10 realworld: server entry on Controllers (infra and the GET /tags slice)

Touches: [apps/realworld/server/**, apps/realworld/vite.config.ts, apps/realworld/src/server.gen.d.ts, apps/realworld/test/**]

## Description
The early proof for R14: put the directory `wrap`, the catch-all and one real route on Controllers end to end, while `rest.ts` keeps serving the rest.

**Size:** M
**Files:** `apps/realworld/server/routes/api/_defaults.ts` (new), `apps/realworld/server/routes/api/index.controller.ts`, `apps/realworld/server/routes/api/[...rest].controller.ts`, `apps/realworld/server/routes/api/tags.controller.ts`, `apps/realworld/server/rest.ts`, `apps/realworld/server/app.ts`, `apps/realworld/server/dev.ts`, `apps/realworld/vite.config.ts`, `apps/realworld/src/server.gen.d.ts`

### Approach
- `_defaults.ts` `wrap`: provide `ViewerLive(token)` from `Authorization: Token` (`rest.ts:184-188`, `identity.ts:180`), port `failure` (`rest.ts:122-148`) and the body/parse error shapes (`rest.ts:150-181`), and map `InvalidPathEncoding`, `MethodNotAllowed`, `BodyTooLarge`, `UnsupportedMediaType` and decode failures as R14 lists (params decode failure 404, body decode 422 with paths relative to the body, `is not valid JSON`, `is too large`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 made `pnpm --filter realworld check` run the Controller pass over `server/routes` (defaults only: `check` has no `serverDir` or `controllersDir` flag). It reads the written call signature of each `wrap`: the services in `next`'s `R` that the result's `R` leaves out (here `Viewer`) count as provided to the Controllers beneath that `_defaults.ts`. Write the `wrap` with `Viewer` named in `next`'s requirements and absent from its result's, as the analyzer fixture `packages/analyze/src/__tests__/fixtures/controllers/server/routes/users/_defaults.ts` does; a generic, `any` or `unknown` `R` discharges nothing and every Controller that requires `Viewer` is a `MissingDependency`. A method with no return annotation whose body returns a union of Effects (`cond ? Effect.fail(x) : Effect.void`) is refused as `ControllerMethodShape` ("does not return an Effect"): annotate it or return one Effect --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.6 delivers a decode failure to `wrap` as one `ParseError` (`_tag: 'ParseError'`, from `effect`) that carries every issue of `params`, `query` and `body` at once, each issue path starting at `params`, `query` or `body` (`['body', 'user', 'email']`), so `wrap` tells the cases apart by the first path element (a `params` issue first for the 404) and drops the leading `body` before it joins the path into the 422 key, where `parseErrors` (`rest.ts:125-130`) joins the whole path. Malformed JSON is one issue at path `['body']` with the message `is not valid JSON`, which the `|| 'body'` fallback there keys as `body`. A missing required body, an empty body included, is an issue at `['body']` with `is missing` (`rest.ts` answered an empty body `is not valid JSON`; `rest.test.ts` has no case for it). `BodyTooLarge` and `UnsupportedMediaType` reach `wrap` as failures of their own, the content-type check runs before the size check, and a `wrap` that leaves any of them answers an empty 413, 415, 405 or 404 and a 400 `DecodeError` JSON for a `ParseError` -->
- `index` and `[...rest]` Controllers answer `/api/` and unknown `/api/` paths with the JSON 404; remove `tags` from the `ROUTES` table (`rest.ts:66-120`) and change the transitional middleware to yield (return `Effect.void`) for any request it has no table entry for, instead of answering its own JSON 404 (`rest.ts:215`). Middleware runs before Controllers, so without this a migrated route and the catch-all are unreachable; each migrated route must also leave the table, and the middleware's 404 branch goes away with `rest.ts` in the next task.
- Plugin: `serverServices()` stays standalone in `vite.config.ts:14`; `server/dev.ts` forwards through the predicate of task 8 instead of `/api/`. <!-- Updated by plan-sync: fn-68-file-routed-controllers.8 gives that predicate as the named export `isControllerPath(pathname)` of `virtual:sleek/server-app` (true when a Controller's pattern matches, so `/api/tags`, `/api/` and, with the catch-all, every `/api/...` path; never `/_sleek/`, which R2 forbids) and exports `devMiddleware(load, accepts)` from `@sleekstack/ui-vite`. Realworld cannot swap to that one: `apps/realworld/server/dev.ts` has its own `devMiddleware(load, documentOf)`, which also injects the server-rendered page into `index.html`, and its `forStart(req)` is synchronous and tests `req.url` (path and query) with `startsWith('/api/')`. Keep it, replace the `/api/` test with a third parameter `isControllerPath: (pathname: string) => boolean | Promise<boolean>` (the Controller predicate may answer after the module loads) applied to `new URL(req.url, ...).pathname`; page navigations still go to `start` by the `text/html` accept rule. `vite.config.ts` passes `async (pathname) => (await server.ssrLoadModule('virtual:sleek/server-app')).isControllerPath(pathname)`. The `dev middleware` tests of `test/server.test.ts:170-196` call `devMiddleware(async () => app, documentOf)` and must pass the predicate too (`(await import('virtual:sleek/server-app')).isControllerPath` under vitest, whose config has the plugin); the `/api/tags` case there is the one that proves the forwarding. The generated declaration gains, beside `Controllers`, `ControllerModules` (route name to `typeof import(...)` of its module) and `isControllerPath: (pathname: string) => boolean`, declared only while a Controller exists, so `server.test.ts` typechecks against it only after the `tags` Controller lands. The module's load now also runs the analyzer's Controller pass: every code (`MissingDependency`, `ControllerMethodShape`, `ControllerParamsMismatch`, ...) fails it with `file:line`, so the first `app.fetch` in a test or the first dev request throws the list, not only `pnpm --filter realworld check`; a Controller outside the tsconfig program fails it too (realworld's `include` has `server`, so `server/routes/**` is in) and an error leaves the previous declaration in place. The module also has a page `router` getter when the file-routes plugin is in the config (realworld's `routes()` is) and `routesDir` has routes, and the explicit `start({ router: pages })` in `server/app.ts` keeps winning, so leave it --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.7 made `serverServices()` find `server/routes/**` with no option here (`controllersDir` defaults to `server/routes`, and the page routes it checks Controllers against come from `routesDir`, default `src/routes`, which is where `routes()` reads). Once a Controller exists the plugin rewrites `apps/realworld/src/server.gen.d.ts` itself, adding a `virtual:sleek/server-app` section with `interface Controllers` (route name to pattern) and "and the Controllers" in its header: commit that output and never hand-edit it. A discovery error (two Controllers or a Controller and a page route at one path, an orphan `*.controller.ts` under `server/`) fails the load of the discovered app naming the files, so in dev it shows on the first request, not at startup -->
- Run the REST tests unchanged after every step.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/server/rest.ts:58-226`
- `apps/realworld/test/rest.test.ts:11-27,220-264`
- `apps/realworld/vite.config.ts` and `apps/realworld/server/dev.ts:13-16`
- `apps/realworld/server/identity.ts:175-200`

**Optional**:
- `apps/realworld/src/errors.ts:7-18`

## Acceptance
- [ ] `GET /api/tags` is served by a Controller; the transitional middleware passes unmatched `/api/` requests on and still serves its remaining routes
- [ ] `rest.test.ts` passes; the only edits are `Content-Type: application/json` on the two size-limit requests (`:237`, `:245`), whose 413 assertions stay (R17 checks the media type before the size); a separate test covers the 415
- [ ] the catch-all and `index` answer the JSON 404; an unsupported method and a malformed escape answer the JSON 404 through the directory `wrap`
- [ ] an invalid token on an unknown route answers 401 (the intended difference in R14), documented in the test
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass

## Done summary
`GET /api/tags`, `/api/` and every `/api/` path with no route now go through Controllers under `apps/realworld/server/routes/api`, with a directory `wrap`. `rest.ts` still serves the other 18 routes (R14, first slice).

- `_defaults.ts` `wrap` does two things:
  - It provides `ViewerLive(token)` from `Authorization: Token`.
  - It maps failures to RealWorld `{errors}` answers:
    - the domain errors, as `rest.ts` maps them
    - `InvalidPathEncoding` and `MethodNotAllowed`: 404 `{body: ['not found']}`
    - `BodyTooLarge`: 413 `is too large`
    - `UnsupportedMediaType`: 415 `{body: ['must be application/json']}`
    - a decode `ParseError`: 404 when any issue's path starts at `params`. Otherwise 422, keyed by the path with its first element (`body`/`query`) dropped, or by `body` when nothing is left. Malformed JSON therefore stays `body: ['is not valid JSON']`.
  - Its written signature takes `next: Effect<Response, Failure, Viewer>` and returns `Effect<Response, never, Db | TokenSecret>`, so `sleekstack check` counts `Viewer` as provided. A probe confirmed it: a Controller that requires `Viewer` passes `check`, and fails with `MissingDependency` once `next` drops `Viewer`.
- Controllers:
  - `index` (`/api`) and `[...rest]` (`/api/*rest`, declaring `params: { rest: string }`) export `GET`, which fails with the domain `NotFound({ resource: 'body' })`. The wrap turns that into the JSON 404, and any other method there gets the same 404 through `MethodNotAllowed`.
  - `tags` `GET` has a written return type.
- `rest.ts`:
  - `tags` is removed from `ROUTES`.
  - A request with no table entry or a malformed param now returns `Effect.void` and reaches the Controllers. The middleware's own 404 is gone.
  - `failure`, `tokenOf` and the body reader stay duplicated there until task 11 deletes the file.
- `server/dev.ts` `devMiddleware(load, documentOf, isControllerPath)`:
  - The `/api/` prefix test is replaced by a predicate applied to the URL's pathname. The predicate may return a promise.
  - Forwarding is the same as before, except that it runs after the predicate resolves.
  - `vite.config.ts` passes `ssrLoadModule('virtual:sleek/server-app').isControllerPath`.
  - `server.test.ts` passes the module's `isControllerPath`.
- `src/server.gen.d.ts` is the plugin's regenerated output, committed as written: `Controllers`, `ControllerModules` and `isControllerPath`.
- Tests (`test/rest.test.ts`):
  - `content-type: application/json` was added to the two size-limit requests; their 413 assertions are unchanged.
  - New: `/api/ itself is 404` (the index Controller).
  - New: `a bad token is 401 on an unknown route, method or escape too`, which documents the R14 intended difference.
  - New: the directory wrap answers a body without application/json with 415, a failed `params` decode with 404, and a failed body decode with 422 keyed `user.email`. This test calls `wrap` directly, because no migrated Controller declares `body` yet, so a 415 cannot come from `fetch` in this task.
  - The 415 and decode-mapping test is the only coverage of the wrap's `ParseError`, 413 and 415 branches until task 11 moves the body routes. Task 11's fetch tests (malformed JSON, missing envelope key, non-numeric comment id, 413) will exercise them end to end.
- Mutation check. Each mutation turned at least one test red, and the code was then restored:
  - the middleware answering 404 again
  - no `index` Controller
  - no `tags` Controller
  - the 415 status changed
  - the `params` to 404 rule removed
  - no relative-path slice
- Dev smoke on a real `vite` server:
  - `/api/tags` 200
  - `/api/nope` and `/api/` JSON 404
  - a bad token on `/api/nope` 401
  - `/api/profiles/nobody` still served by `rest.ts` (404 `profile`)
  - `/src/main.tsx` served by Vite

Behaviour changes beyond R14's list: `OPTIONS /api/tags` answers 204 with `Allow` (R9 default), and `/api` without a trailing slash answers the JSON 404 instead of the page router.

Gates:
- Baseline was green on a full run, since there was no receipt for HEAD: 28/28 tasks, and `pnpm --filter realworld check` exit 0.
- Post-edit Quick command: green, 28/28 tasks, realworld 158 tests (155 before). Receipt `.flow/tmp/green-receipts/db02a6dd-unittest.json`.
- `pnpm --filter realworld check`: exit 0.
- `pnpm --filter docs test`: 58/58.
- `prettier --check apps/realworld`: clean.
- Fixture graph check: not run. There is no public export change; only realworld app files changed.

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - ran (sonnet; updated task 11)
## Evidence
- Commits: db02a6dd64dc4568a9b4529de6b7cefd9f13e800
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, pnpm --filter docs test, npx prettier --check apps/realworld
- PRs: