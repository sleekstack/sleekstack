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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
