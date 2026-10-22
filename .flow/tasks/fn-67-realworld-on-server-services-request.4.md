---
satisfies: [R3, R4, R5]
---
# fn-67-realworld-on-server-services-request.4 realworld: the articles Server Service

## Description
Same migration for `ArticlesApi`: list, feed, get, create, update, delete, favorite, unfavorite and tags replace their 9 contracts, with the pages and loaders that call them. Comments still use `ServerFunctions`.

**Size:** M
**Files:** apps/realworld/src/modules/articles/application/contracts.ts (replaced by the Tag), apps/realworld/src/modules/articles/index.ts, apps/realworld/server/articles-api.server.ts (new), apps/realworld/server/app.ts, apps/realworld/src/pages/loaders.ts, apps/realworld/src/routes/_home.tsx, apps/realworld/src/routes/article/[slug].tsx, apps/realworld/src/routes/(guarded)/editor/_editor.tsx, apps/realworld/src/routes/tag/, apps/realworld/test/feed.test.ts, apps/realworld/test/article.test.ts
**Touches:** [apps/realworld/**]

### Approach
- Follow task 3's shape exactly: Tag in the articles module (client-safe), `implement(ArticlesApi, {...})` in a `*.server.ts` file reusing the existing domain functions the `viewerFn` calls today (`listArticles`, `feed`, `getArticle`, ... in `server/articles.ts`), the registry and Layer added to the server entry, the 9 `viewerFn` entries removed.
- `loaders.ts` has typed helpers around `Stub<typeof listArticlesContract>` (`ListFailure`, `Query`, `first`); re-derive those from the Tag's method type instead of a contract stub. The error union of the list method includes `NetworkError | DecodeError` on the Tag.
- Pages: `_home.tsx` (lists, tags), `article/[slug].tsx` (get, favorite), the editor (create, update, delete), `tag/` (lists).
- Tests: `feed.test.ts` and `article.test.ts` give their `startRouter` layers the generated browser Layer; assertions unchanged.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/src/modules/articles/application/contracts.ts` and `lists.ts` — the 9 contracts and list helpers
- `apps/realworld/server/app.ts` (articles entries) and `server/articles.ts` — the domain functions
- `apps/realworld/src/pages/loaders.ts:40-110` — the list/query typing built on contract stubs
- `apps/realworld/src/routes/_home.tsx`, `article/[slug].tsx`, `(guarded)/editor/_editor.tsx`
- `apps/realworld/test/feed.test.ts:80-100`, `article.test.ts:85-105`

**Optional** (reference as needed):
- `apps/realworld/server/identity-api.server.ts` (task 3) — the shape to follow

## Acceptance
- [ ] `ArticlesApi` exists as one Tag with 9 methods; none of the 9 articles contract objects remains; the articles entries are gone from `functions`.
- [ ] Pages and loaders for lists, articles, favorites, tags and the editor call `yield* ArticlesApi`; the list helpers in `loaders.ts` derive their types from the Tag.
- [ ] The existing feed and article tests pass with only their layer construction changed.
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass; the client bundle holds no `*.server.ts`.

## Done summary
Realworld's articles are now the `ArticlesApi` Server Service. The Tag is in `src/modules/articles/application/contracts.ts`, with 9 methods: list, feed, get, create, update, delete, favorite, unfavorite and tags. The 9 contracts and their `functions` entries are gone. `server/articles-api.server.ts` builds `ArticlesApiLive` with `implement`, which takes `Db | TokenSecret` once and runs each call through `asViewer`. `create` turns the domain function's `NotFound` (from re-reading the article it just wrote) into a defect, because the contract never declared it. The server layer merges `IdentityApiLive` and `ArticlesApiLive` over the old base layer. The loaders, `_home.tsx`, `article/[slug].tsx` and the editor call `yield* ArticlesApi`. `ListFailure` in `loaders.ts` is now `Effect.Error<ReturnType<Context.Tag.Service<ArticlesApi>['list']>>`. `tag/[tag].tsx` needed no change. In the feed, article and server tests, the only change is the wire ids (`ArticlesApi.*`, and `tags.list` became `ArticlesApi.tags`). Their layers already merged the generated browser Layer.

Follow-up (packages/start, outside this task's Touches): `start({ services })` types `services` as `ReadonlyArray<ServerServiceEntry<RS>>`. `Context.Tag` is invariant in its id, so a registry with two Tags fails to typecheck: TS infers only the first Tag. `server/app.ts` works around this with a cast that keeps the Tags precise, `services as unknown as ReadonlyArray<ServerServiceEntry<IdentityApi | ArticlesApi>>`, marked with a `ponytail:` comment. `start` should infer RS from the registry's own entry type; the cast can then be dropped. Task .5 needs `CommentsApi` added to the cast, or this fix.

baseline: green (pnpm turbo run test typecheck --filter=realworld && pnpm --filter realworld check, pre-edit)

Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 302e346f82579282e3b7027b618a31a0a6564947
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check, pnpm --filter realworld build
- PRs: