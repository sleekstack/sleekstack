---
satisfies: [R10]
---
# fn-69-server-auto-wiring.10 realworld: identity and articles RPC Files, pages on virtual:sleek/rpc, architecture rules

Touches: [apps/realworld/server/**, apps/realworld/src/**, apps/realworld/test/**, apps/realworld/vite.config.ts]

## Description
Finish R10: the other two Server Services become RPC Files, pages import generated Tags, and the architecture and client-chunk tests follow.

**Size:** M
**Files:** `apps/realworld/server/identity-api.rpc.ts`, `articles-api.rpc.ts` (new; the `*-api.server.ts` files are deleted), `apps/realworld/src/modules/{identity,articles}/application/contracts.ts` (deleted) and their `index.ts`, `apps/realworld/src/routes/_auth.tsx:7`, `_home.tsx:8`, `(guarded)/settings.tsx:6`, `(guarded)/editor/_editor.tsx:6`, `apps/realworld/src/pages/loaders.ts:12-14` (and type uses at `:36,:46-51`), `apps/realworld/test/architecture.test.ts`, `apps/realworld/test/server.test.ts`, `apps/realworld/vite.config.ts`, `apps/realworld/src/server.gen.d.ts`

### Approach
- Identity (cookie session: register, login, logout, current, update, profile, follow, unfollow) and articles (the rest) as RPC Files with written signatures reproducing the contracts; the identity `wrap` is the cookie viewer (`asViewer`, `identity-api.server.ts:18-37`); a non-function export such as `SESSION` stays in the non-RPC module from the previous task. <!-- Updated by plan-sync: fn-69-server-auto-wiring.9 moved `SESSION`, `asViewer`, `secure` and `signIn` out of `identity-api.server.ts` into `apps/realworld/server/session.ts` (the non-RPC module), so `identity-api.server.ts:18-37` no longer holds them: `identity-api.rpc.ts` imports `{ asViewer, SESSION, signIn }` from `./session` and declares `export const wrap: RpcWrap = asViewer` (type `RpcWrap` from `@sleekstack/start`). Copy `server/comments-api.rpc.ts` as the pattern: written signatures with `R = Db | TokenSecret | Viewer`, errors from `../src/errors`, schema types via `Schema.Schema.Type<typeof X>` from the module index, `delete`-style reserved names via `export { x as y }`. `register` and `login` end in `signIn` (needs `Cookies` and `Request`, both request services), `logout` deletes the `SESSION` cookie. `articles-api.server.ts` already imports `asViewer` from `./session`; its `articles-api.rpc.ts` does the same -->
- State left by fn-69-server-auto-wiring.9 (do not redo): `server/db.layer.ts`, `token-secret.layer.ts` and `queries.layer.ts` are Layer Files (default exports of `DbLive(process.env.CONDUIT_DB)`, `TokenSecretLive`, `QueryClientLive(...)`), so no infra Layer is listed anywhere; `server/comments-api.rpc.ts` is the comments RPC File and `CommentsApi` comes from `virtual:sleek/rpc` (`src/pages/loaders.ts` and `src/routes/article/[slug].tsx` already import it; `modules/comments/application/contracts.ts` is deleted and `modules/comments/index.ts` no longer exports it, so do the same for identity and articles). `server/app.ts` is now `start({ router: pages, layer: Layer.mergeAll(AppLive, IdentityApiLive, ArticlesApiLive), services })` plus `export { SESSION } from './session'`: this task deletes `IdentityApiLive` and `ArticlesApiLive` and their imports, leaving `layer: AppLive` (`src/layers.ts`, still hand-written), and keeps the `SESSION` re-export because `test/server.test.ts:9` imports it from `../server/app`. `loaders.ts` today imports `{ Article, ArticleList, ArticlesApi }` and `{ Account, IdentityApi, Profile }` from the modules and `{ CommentsApi }` from `virtual:sleek/rpc`: keep the schema classes on the module indexes and move only the Tags (`ArticlesApi`, `IdentityApi`) to the `virtual:sleek/rpc` import. `test/rest.test.ts` still imports `DbLive` from `../server/db`, `TokenSecretLive` from `../server/identity` and `wrap` from `../server/routes/api/_defaults`: those modules remain, do not move them. The analyzer side is done: `checkStart` (`packages/analyze/src/serverServices.ts`) counts a Tag declared by `virtual:sleek/rpc` as provided for `start({ services })`, so deleting the two `*Live` Layers needs no further analyzer change; if `pnpm --filter realworld check` still reports one, that file is outside this task's Touches, so name it rather than edit it
- Pages and loaders import the Tags from `virtual:sleek/rpc`; extend `architecture.test.ts` (`ruleOf` `:37-89`: `pages/`, `routes/`, module presentation) to allow it while still rejecting server-only imports in pages, and put the discovery plugin in the client-chunk test's plugin list (`:201`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.10: the client-chunk test's plugin list already is `[routes(), serverServices()]` (`architecture.test.ts:201`), so nothing is added there; the test needs only the new generated modules in its markers. In `ruleOf` the `pages/` rule (`:64-69`), the `routes/` rule (`:70-83`) and the presentation rule (`:49-54`) have no `virtual:sleek/rpc`; the `main` rule allows `virtual:sleek/server` only. <!-- Updated by plan-sync: fn-69-server-auto-wiring.9 already added `const RPC = 'virtual:sleek/rpc'` (`architecture.test.ts:~36`) to the `pages/` and `routes/` rules of `ruleOf` and that was its only change to the file, so what remains is the presentation rule (`:49-54`, only if a module's presentation file imports a Tag; none of the listed consumers is one) and the client-chunk markers for the new generated modules. The "still rejects a server-only import in a page" check is unchanged --> The Tag consumers are `src/pages/loaders.ts:12-14`, `src/routes/_auth.tsx:7`, `_home.tsx:8`, `(guarded)/settings.tsx:6`, `(guarded)/editor/_editor.tsx:6`, `profile/_profile.tsx:7` and `article/[slug].tsx:7-8`; the tests call by wire id string, so they import no Tag -->
- Keep wire ids `IdentityApi.*` and `ArticlesApi.*` so `server.test.ts` only changes imports; delete the old contracts, `implement` calls and `*Live` files.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/server/identity-api.server.ts`, `articles-api.server.ts`
- `apps/realworld/src/modules/identity/application/contracts.ts`, `articles/application/contracts.ts`
- `apps/realworld/test/architecture.test.ts:37-212`, `test/server.test.ts`

**Optional**:
- `.flow/memory/bug/integration/lazy-file-routes-links-need-code-2026-10-21.md`

## Acceptance
- [ ] no contract, `implement` call or `*Live` Layer remains in realworld; wire ids are unchanged
- [ ] pages and loaders import generated Tags; the architecture test allows `virtual:sleek/rpc` and still rejects a server-only import in a page
- [ ] the client-chunk test passes with the discovery plugin
- [ ] the whole realworld suite passes with only import and wiring edits
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
