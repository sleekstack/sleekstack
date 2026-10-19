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
Every in-app anchor in `apps/realworld` is now a router `Link` with its original `class` and `href`. That covers the header, footer, not-found page, feed tabs, tag pills, article/profile/comment author links, previews, favorite/follow sign-in links, auth footers and the Edit link. The thinkster.io link stays a plain anchor. Header, footer and not-found links take `table` only, so nothing prefetches there. Page-body links pass the target route's loaders as `app.tsx` declares them.

The loaders that another page's link names (`article`, `comments`, `profile`, `authoredArticles`, `favoritedArticles`, `editable`, `articleSource`) moved to a leaf module, `src/pages/loaders.ts`, along with the route loader sets and `previewLinks`. Before, page modules imported each other at evaluation time, so naming them from another page would have created a TDZ import cycle. `article.tsx`, `profile.tsx` and `editor.tsx` re-export the moved loaders, so `app.tsx` (outside Touches) is unchanged. In `editor.tsx` only the imports and the `editable` definition changed; fn-63's textarea hunk is near line 75, so the two edits do not overlap.

The previews (`modules/articles/presentation/preview.tsx`) render `Link` directly and receive a `links` prop from the page (the table plus loader sets). An injected link component failed `sleekstack check` as a dynamic component. `test/architecture.test.ts` now allows `@sleekstack/router` in presentation.

Tests: `test/feed.test.ts` adds a parametrized "hovering %s link prefetches its route's loaders; following it then makes no call" over a tag, an article preview and a preview author link. Each case was confirmed red with empty loaders. No anchor selector in auth.test.ts or article.test.ts needed a change.

Follow-up: once fn-63 merges, `app.tsx` can import the loaders from `pages/loaders.ts` and the re-exports can go.

baseline: green via handoff (fn-62...1: Quick command 19/19 on its final commit; only .flow/ changed since)
Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out round 1 NEEDS_WORK: preview links had no loaders [P2], Edit link was missing `editable` [P3]; both fixed; round 2 SHIP)
## Evidence
- Commits: 57ccee0385935c44604457a964d15c020783d7a0, aaf72ae71defff7d89d1ae445802db144e5ea333
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld, pnpm --filter realworld check, pnpm format:check
- PRs: