---
satisfies: [R1, R3]
---
# fn-61-realworld-app-on-sleekstack.3 Articles, tags, favorites and comments services

Touches: apps/realworld/src/modules/articles/**, apps/realworld/src/modules/comments/**, apps/realworld/server/**, apps/realworld/test/articles*.test.ts

## Description
Services for article list (filters tag/author/favorited, limit/offset, total `articlesCount`), feed, get, create, update, delete (owner only, cascade), tags list, favorite/unfavorite (idempotent, COUNT-derived), comments add/list/delete (author only, newest first). Viewer-relative `favorited`/`following`.

**Size:** M
**Files:** `src/modules/articles/**`, `src/modules/comments/**`, `server/articles.ts`, `server/comments.ts`, `test/articles.test.ts`, `test/comments.test.ts`

### Approach
- Slug: slugified title, numeric suffix on collision, UNIQUE + retry; title change regenerates slug.
- Clamp pagination; non-numeric -> `ValidationError`; order `createdAt DESC, id DESC`; `tagList` sorted/trimmed/deduped.
- Injected clock and id source so ordering is deterministic.

### Investigation targets
**Required**:
- task 2's identity module (reuse Viewer, errors)
- `apps/showcase/src/modules/tasks/`

### Acceptance
- [ ] Non-owner update/delete -> Forbidden; unknown slug -> NotFound; empty title/description/body or comment -> field errors
- [ ] Pagination boundaries (offset past count, limit 0, huge), tag+author+favorited combined, delete cascade, anonymous vs signed-in vs author flags

## Acceptance
- [ ] TBD

## Done summary
Added the article, tag, favorite and comment services. They are server-only in `server/articles.ts` and `server/comments.ts`. The client-safe Schemas (Article, ArticleList, NewArticle, UpdateArticle, Page, ArticleQuery, Comment, NewComment) live in `src/modules/{articles,comments}/domain/model.ts`.

- `listArticles` takes tag, author and favorited filters, combined with AND, and returns the total `articlesCount`. `feed` requires a viewer and lists articles by the authors they follow. Both order by `created_at DESC, id DESC`. `limit` defaults to 20 and clamps to [1, 100]. `offset` defaults to 0 and clamps to [0, MAX_SAFE_INTEGER]. A non-numeric value fails as a `ValidationError` keyed by the field (`must be a number`). An unknown author or tag returns an empty page, not NotFound.
- Create, update and delete: only the author may update or delete an article (`Forbidden {article: ['is not yours']}`). An unknown slug is `NotFound {resource: 'article'}`. A blank title, description or body gets a field error (`can't be blank`). Update writes only the given columns plus `updated_at`. An optional `tagList` on update replaces the tags; this is an addition for the editor. A changed title regenerates the slug: the slug comes from the title, a collision gets a numeric suffix `-2`, `-3` and so on, and the UNIQUE index decides with a retry. Writes run in a transaction. Delete cascades through foreign keys.
- `tagList` is trimmed, deduped and sorted, and blank tags are dropped. `tags` lists only the tags in use. Favorite and unfavorite are idempotent, and `favoritesCount` is derived by COUNT. `favorited` and `author.following` are relative to the viewer and computed in one SQL read; an anonymous viewer gets false.
- Comments: add needs a viewer and a non-blank body. The list is newest first. Only the comment author may delete a comment (the article's author may not), and an unknown comment is `NotFound {resource: 'comment'}`.
- Clock: timestamps come from Effect `Clock`, so `TestClock` drives the ordering. Ids are SQLite rowids, which are deterministic per database, so I did not inject a separate id source.
- Tests: `test/articles.test.ts` (31 cases) and `test/comments.test.ts` (8 cases) cover every AC error case: Forbidden, NotFound, blank fields, and Unauthorized. They also cover the pagination boundaries (offset past the count, limit 0, a huge limit, a negative offset, offset 1e20, non-numeric input), the combined tag+author+favorited filter, the delete cascade, and the anonymous, signed-in and author flags. Mutation checks turned the tests red when I removed the owner check, the clamp, the non-numeric check, the comment ordering, the comment-owner check, or the slug regeneration.
- Review fixes: the Codex review found that tags were aggregated with a U+001F delimiter, which split a tag containing that character. It also found that a huge offset threw `datatype mismatch`. Fixed in 31dbf5d: tags now aggregate with `json_group_array`, and the offset is capped. Both fixes have regression tests that failed before the fix. I also added a memory entry, `bug/data/sql-tag-aggregation-must-be-lossless`.
- Note for task 4/5: `server/articles.ts` exports `articleAt` and `viewerId`, which comments reuse. Articles in a list include `body`. If the REST facade has to drop `body` from lists, it should do that in the facade.
- `baseline: green via handoff (verified at 02d5afb by fn-61-realworld-app-on-sleekstack.2)`
- GATE_SKIPPED:unittest:green-receipt 31dbf5d2 - baseline reused from prior post-gate pass
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out rid e3f5d99b2f484e6eb9708eb6bb3fe205 NEEDS_WORK x3 -> fix 31dbf5d -> re-review SHIP)
## Evidence
- Commits: 8b9684045373b065087a01ae45d1f7150ca8cd96, 31dbf5d20df89ff6e44f55dc750eec31fb2edd08
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check, GATE_SKIPPED:unittest:green-receipt 31dbf5d2 - baseline reused from prior post-gate pass
- PRs: