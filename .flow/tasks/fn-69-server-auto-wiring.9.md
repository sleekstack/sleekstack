---
satisfies: [R1, R10]
---
# fn-69-server-auto-wiring.9 realworld: Layer Files, comments RPC File and the server entry

Touches: [apps/realworld/server/**, apps/realworld/src/modules/comments/**, apps/realworld/src/server.gen.d.ts, apps/realworld/vite.config.ts, apps/realworld/test/**]

## Description
The first realworld slice of R10: the infra becomes Layer Files, the smallest service (comments, 3 methods incl. `delete`) becomes an RPC File, and `server/app.ts` shrinks.

**Size:** M
**Files:** `apps/realworld/server/db.layer.ts`, `token-secret.layer.ts`, `queries.layer.ts` (new), `apps/realworld/server/comments-api.rpc.ts` (new, replaces `comments-api.server.ts`), a non-RPC server module for `asViewer`, `signIn`, `secure` and `SESSION` (moved out of `identity-api.server.ts:18-37`), `apps/realworld/src/modules/comments/application/contracts.ts` (deleted) and `modules/comments/index.ts`, `apps/realworld/server/app.ts`, `apps/realworld/src/server.gen.d.ts`, `apps/realworld/test/**`

### Approach
- Convert `DbLive(process.env.CONDUIT_DB)`, `TokenSecretLive` and `ServerQueriesLive` into Layer Files (the browser's `AppLive` and `QueriesLive` stay hand-written in `src/layers.ts`). Tests set `CONDUIT_DB` before importing the app, as `rest.test.ts` does.
- `comments-api.rpc.ts`: written signatures reproducing the contract (`contracts.ts:11-30`), the viewer provided by the file's `wrap` (`RpcWrap`), `delete` exported as `export { remove as delete }`; file name keeps the Tag and wire ids `CommentsApi.*`.
- `app.ts` drops the infra Layers and the comments Layer (`app.ts:28-35`) but keeps an explicit `layer` of the still hand-written `IdentityApiLive` and `ArticlesApiLive` (and the generated registry, which `start` de-duplicates by Tag) until the next task replaces them; the explicit `layer` wins for any Tag it provides; the page router stays explicit or is discovered according to the sibling spec's R11; keep `SESSION` importable for tests (`server.test.ts:9`).
- Pages and tests that use the comments Tag import it from `virtual:sleek/rpc`; commit the regenerated `src/server.gen.d.ts`. The sibling spec's Controllers (REST) are untouched.

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
TBD

## Evidence
- Commits:
- Tests:
- PRs:

