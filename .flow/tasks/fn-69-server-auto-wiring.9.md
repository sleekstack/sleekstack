---
satisfies: [R1, R10]
---
# fn-69-server-auto-wiring.9 realworld: Layer Files, comments RPC File and the server entry

Touches: [apps/realworld/server/**, apps/realworld/src/modules/comments/**, apps/realworld/src/server.gen.d.ts, apps/realworld/vite.config.ts, apps/realworld/test/**, apps/realworld/src/pages/loaders.ts, apps/realworld/src/routes/article/[slug].tsx, packages/analyze/src/serverServices.ts, packages/analyze/src/__tests__/**]

## Description
The first realworld slice of R10: the infra becomes Layer Files, the smallest service (comments, 3 methods incl. `delete`) becomes an RPC File, and `server/app.ts` shrinks.

**Size:** M
**Files:** `apps/realworld/server/db.layer.ts`, `token-secret.layer.ts`, `queries.layer.ts` (new), `apps/realworld/server/comments-api.rpc.ts` (new, replaces `comments-api.server.ts`), a non-RPC server module for `asViewer`, `signIn`, `secure` and `SESSION` (moved out of `identity-api.server.ts:18-37`), `apps/realworld/src/modules/comments/application/contracts.ts` (deleted) and `modules/comments/index.ts`, `apps/realworld/server/app.ts`, `apps/realworld/src/server.gen.d.ts`, `apps/realworld/test/**`

### Approach
- Convert `DbLive(process.env.CONDUIT_DB)`, `TokenSecretLive` and `ServerQueriesLive` into Layer Files (the browser's `AppLive` and `QueriesLive` stay hand-written in `src/layers.ts`). Tests set `CONDUIT_DB` before importing the app, as `rest.test.ts` does. <!-- Updated by plan-sync: fn-68-file-routed-controllers.10 and .11. Realworld's `server/routes/api/_defaults.ts` `wrap` requires `Db | TokenSecret` (`next` to `Effect<Response, never, Db | TokenSecret>`), and `sleekstack check` counts a requirement as provided only by `start({ layer })`, a `wrap` above it or the request services, so `pnpm --filter realworld check` reports `MissingDependency` once those Layers leave `app.ts` unless task 1 teaches `controllers.ts` about Layer File outputs (see its note). `test/rest.test.ts` imports `DbLive` from `../server/db`, `TokenSecretLive` from `../server/identity` and `wrap` from `../server/routes/api/_defaults` for its direct `wrap` test: keep those importable or change the import -->
- `comments-api.rpc.ts`: written signatures reproducing the contract (`contracts.ts:11-30`), the viewer provided by the file's `wrap` (`RpcWrap`), `delete` exported as `export { remove as delete }`; file name keeps the Tag and wire ids `CommentsApi.*`.
- `app.ts` drops the infra Layers and the comments Layer (`app.ts:28-35`) but keeps an explicit `layer` of the still hand-written `IdentityApiLive` and `ArticlesApiLive` (and the generated registry, which `start` de-duplicates by Tag) until the next task replaces them; the explicit `layer` wins for any Tag it provides; the page router stays explicit or is discovered according to the sibling spec's R11; keep `SESSION` importable for tests (`server.test.ts:9`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.10 and .11: `app.ts` is now `start({ router: pages, layer: Layer.mergeAll(IdentityApiLive, ArticlesApiLive, CommentsApiLive).pipe(Layer.provideMerge(Layer.mergeAll(AppLive, ServerQueriesLive, DbLive(process.env.CONDUIT_DB), TokenSecretLive))), services })`: the REST middleware is gone with `rest.ts`, and it re-exports `SESSION` from `./identity-api.server`. `AppLive` (`src/layers.ts`, `Layer.empty` today) stays hand-written in the explicit layer. The discovered app already carries a page `router` getter because realworld's config has `routes()` (fn-68-file-routed-controllers.8), and an explicit `router: pages` wins, so that line may stay or go -->
- Pages and tests that use the comments Tag import it from `virtual:sleek/rpc`; commit the regenerated `src/server.gen.d.ts`. The sibling spec's Controllers (REST) are untouched. <!-- Updated by plan-sync: fn-68-file-routed-controllers.11: realworld's tests call by wire id string (`'CommentsApi.list'`), so only pages import the Tag. Touches note: the comments Tag is imported through `modules/comments` by `apps/realworld/src/pages/loaders.ts:13` and `apps/realworld/src/routes/article/[slug].tsx:8`, which Touches does not cover (it names only `src/modules/comments/**` under `src/`) -->


### Investigation targets
**Required** (read before coding):
- `apps/realworld/server/app.ts:1-35`, `comments-api.server.ts:1-21`, `identity-api.server.ts:18-66`
- `apps/realworld/src/modules/comments/application/contracts.ts`
- `apps/realworld/test/server.test.ts:33-133`

**Optional**:
- `apps/realworld/vite.config.ts`, `src/main.tsx:3`

## Acceptance
- [ ] `server/app.ts` lists no infra Layer and no comments Layer; the identity and articles Layers stay explicit until the next task, and the realworld suite passes with only import changes
- [ ] comments wire ids are still `CommentsApi.*`; `delete` works on the wire and in process
- [ ] REST token auth and the cookie session still work side by side
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass

## Done summary
Realworld's infra became Layer Files (`server/db.layer.ts`, `token-secret.layer.ts`, `queries.layer.ts`) and comments became an RPC File (`server/comments-api.rpc.ts`, `list`/`add`/`export { remove as delete }`, viewer from `wrap: RpcWrap = asViewer`); `SESSION`, `asViewer`, `secure`, `signIn` moved to `server/session.ts`; `server/app.ts` keeps only `layer: Layer.mergeAll(AppLive, IdentityApiLive, ArticlesApiLive)`; pages import `CommentsApi` from `virtual:sleek/rpc`; comments `contracts.ts` and `comments-api.server.ts` are deleted and `src/server.gen.d.ts` regenerated.

The analyzer's `checkStart` (`packages/analyze/src/serverServices.ts`) now counts a Tag declared by `virtual:sleek/rpc` (RPC File or Manifest, which the discovered app provides) as provided for `start({ services })`; a hand-written Server Service with no implementation Layer is still reported. Test: `serverServices.test.ts` fixture `server-service-start-generated` (run red first: it reported `Notes`).

baseline: green (all Quick commands, turbo cache, pre-edit; recorded by the previous worker)
stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
Tier: session (jev-unavailable(no_key)); routing block sets opus at medium
## Evidence
- Commits: efb2b86309e90cc84b292700c051ce86e719254b
- Tests: pnpm turbo run test typecheck --force --concurrency=1 --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld --filter=showcase, pnpm --filter realworld check, pnpm --filter realworld build, pnpm turbo run test typecheck build --filter=docs --concurrency=1 --force, pnpm format:check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts)
- PRs: