---
satisfies: [R4]
---
# fn-62-router-link-takes-anchor-attributes-and.2 Switch realworld in-app links to Link

Touches: apps/realworld/src/pages/**, apps/realworld/src/modules/articles/presentation/preview.tsx, apps/realworld/test/**

## Description
Replace the in-app `<a>` elements in `apps/realworld` with router `Link` (with `class`), keep external links as anchors, and thread `table` (and a route's loaders where they are known) so prefetch is on where it can work.

**Size:** M
**Files:** `src/pages/{layout,home,profile,article,auth}.tsx`, `src/modules/articles/presentation/preview.tsx`, tests under `test/` that select anchors

### Approach
- Sites (line numbers at planning time): `layout.tsx` 37, 42, 49, 54, 59, 68, 73, 88, 113, 120 (line 92 is the external thinkster.io link: leave it); `home.tsx` 129 (tag pill) and 143 (`TabLink`); `profile.tsx` 54, 86, 102; `article.tsx` 61, 83, 85, 185, 188, 226; `auth.tsx` 106, 112; `preview.tsx` 44, 63, 67, 74.
- `table` comes from `src/pages/routes.ts` (it exports `table`; check for an import cycle with `layout.tsx`).
- The shared header has no single route's loaders, so its links take `table` only; page-body links (article, profile, tag, feed tabs) pass the target route's loaders and `code` where the route is lazy, so hover/focus prefetch works. Do not invent loaders that a route does not declare (`src/app.tsx` declares them per route).
- The not-found header (`layout.tsx` ~108) has no route: `Link` with `table` and no loaders.
- Update the settings/profile/article tests only where they select anchors by structure.

### Investigation targets
**Required**:
- `apps/realworld/src/pages/routes.ts`, `apps/realworld/src/app.tsx:19-40`
- `apps/realworld/src/pages/layout.tsx`, `apps/realworld/src/pages/home.tsx`
- `apps/realworld/test/article.test.ts`, `apps/realworld/test/feed.test.ts`

### Acceptance
- [ ] Every in-app link is a `Link` with its original `class` and `href`; external links stay anchors
- [ ] A hover on a page-body link prefetches its route's loaders (one test)
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` green; `pnpm format:check` clean

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
