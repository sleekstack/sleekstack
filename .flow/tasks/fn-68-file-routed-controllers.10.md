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
- `_defaults.ts` `wrap`: provide `ViewerLive(token)` from `Authorization: Token` (`rest.ts:184-188`, `identity.ts:180`), port `failure` (`rest.ts:122-148`) and the body/parse error shapes (`rest.ts:150-181`), and map `InvalidPathEncoding`, `MethodNotAllowed`, `BodyTooLarge`, `UnsupportedMediaType` and decode failures as R14 lists (params decode failure 404, body decode 422 with paths relative to the body, `is not valid JSON`, `is too large`).
- `index` and `[...rest]` Controllers answer `/api/` and unknown `/api/` paths with the JSON 404; remove `tags` from the `ROUTES` table (`rest.ts:66-120`) and change the transitional middleware to yield (return `Effect.void`) for any request it has no table entry for, instead of answering its own JSON 404 (`rest.ts:215`). Middleware runs before Controllers, so without this a migrated route and the catch-all are unreachable; each migrated route must also leave the table, and the middleware's 404 branch goes away with `rest.ts` in the next task.
- Plugin: `serverServices()` stays standalone in `vite.config.ts:14`; `server/dev.ts` forwards through the predicate of task 8 instead of `/api/`.
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

