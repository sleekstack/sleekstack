---
satisfies: [R1, R3]
---
# fn-61-realworld-app-on-sleekstack.7 Home feed, tag filter, pagination and profile pages

Touches: apps/realworld/src/pages/{home,tag,profile}.tsx, apps/realworld/src/modules/articles/presentation/**, apps/realworld/test/feed*.test.ts

## Description
Home with tabs (Your Feed for signed-in default, Global Feed, `#tag` tab) as routes `/feed`, `/`, `/tag/:tag`; popular-tags sidebar; article preview list with favorite button (optimistic, rollback on failure), empty state, numbered pagination driven by a client atom folded into the query key. Profile pages `/profile/:username` and `/profile/:username/favorites` with follow/unfollow (or edit-settings link for self) and 404 for an unknown user.

**Size:** M
**Files:** `src/pages/{home,profile}.tsx`, `src/modules/articles/presentation/*`, `test/feed.test.ts`, `test/profile.test.ts`

### Approach
- Router loaders see pathname only: do not use search params. Page atom resets when the route changes.
- `useOptimistic`/`useAction` per showcase's board page; `Link` with prefetch.

### Investigation targets
**Required**:
- `apps/showcase/src/pages/project.tsx`, `packages/router/src/{loader,link}.ts`

### Acceptance
- [ ] Tab defaults by viewer; tag tab; page change refetches; empty state; favorite toggles with rollback on error
- [ ] Profile pages for self, other and unknown user; follow toggles

## Acceptance
- [ ] TBD

## Done summary
Built the home feeds, the tag tab, pagination, favorites and the profile pages. `pages/home.tsx` holds Global Feed (`/`), Your Feed (`/feed`), the `#tag` tab (`/tag/:tag`), the popular-tags sidebar and the shared `ArticleFeed` list. `pages/profile.tsx` holds `/profile/:username` and `/profile/:username/favorites`. The preview, the favorite button, the empty state and the page links are in `modules/articles/presentation/preview.tsx`.

- Data: each list is an `ArticleSource`: a first-page loader (server-rendered, hydrated with no call) plus a `query` for any page. The page number is a client `pageAtom` of `{ path, page }`. On another path it reads as page 0, so it resets when the route changes. Once a page is picked on the current path, every page shown is fetched, page 1 included. That is the review fix: a favorite made on page 1 now survives a round trip to page 2.
- Favorite: `useAction` + `useOptimistic` over a derived "confirmed" atom (the latest server answer, else the loaded article). The count shows at once and rolls back when the call fails. A signed-out viewer gets a link to `/login`.
- Profile: the `profile` loader maps `NotFound` to the router's `notFound()`, so an unknown user gets a 404 page. A follow/unfollow form shows the server's answer. On your own profile an "Edit Profile Settings" link replaces the follow button. Tabs are My Articles and Favorited Articles.
- Tab default by viewer: the header's brand and Home links point to `/feed` for a signed-in viewer and to `/` otherwise. The Your Feed tab is shown only when signed in.
- Outside the listed Touches: `src/app.tsx` (wiring the pages and their loaders), `src/pages/layout.tsx` (the Home link above, and the old `HomePage` removed), `test/architecture.test.ts` (presentation may import `@sleekstack/core` for `Result`), and `modules/articles/index.ts` (exports). The tag page is in `home.tsx`; there is no `tag.tsx`. The profile tests are in `test/feed.test.ts`; there is no `profile.test.ts`.
- Not used: router `Link` with prefetch. `Link` takes no `class` prop, which the Conduit markup needs, and `sleekstack check` cannot read it (memory: sleekstack-check-cannot-read-router). Plain anchors are used. Follow-up candidate: give `Link` a `class` prop.
- Tests: `test/feed.test.ts` has 10 cases. Covered: the anonymous global feed with SSR + hydrate and no call; signed-in Your Feed with the empty state, then the followed author's articles; the tag filter; page change fetching and resetting on route change; favorite toggle; optimistic display then rollback when the server refuses; favorite surviving the page round trip; another user's profile with follow toggle and favorites tab; own profile; 404 for an unknown user.
- Gates: `pnpm turbo run test typecheck --filter=realworld` green (111 tests); `pnpm --filter realworld check` clean.
- baseline: green via handoff (verified at e65b06b by fn-61-realworld-app-on-sleekstack.6)
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out rid 27f0e2b0aee54017a1bb4e829138c251 NEEDS_WORK x3 on one finding, fixed in dcbb9c06, re-review SHIP)
## Evidence
- Commits: 215bcb56ea85fd117ad9052115d8d2b042f24fed, dcbb9c06a5f8667af192c0db2f467fb420cdcf5e
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check
- PRs: