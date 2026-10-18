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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
