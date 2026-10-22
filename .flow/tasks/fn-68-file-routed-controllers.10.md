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
TBD

## Evidence
- Commits:
- Tests:
- PRs:

