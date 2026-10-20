---
satisfies: [R4]
---
# fn-64-router-keeps-the-outgoing-pages-loader.2 realworld settings uses the signedIn guard again

Touches: apps/realworld/src/pages/settings.tsx

## Description
Remove the workaround in the settings page: read `signedIn` (the non-null account, redirecting to `/login` when signed out) instead of the non-redirecting `viewer` loader, and drop the comment that explains the workaround.

**Size:** S
**Files:** `apps/realworld/src/pages/settings.tsx` (workaround comment ~83-84, `SignedInSettings` reading `useLoader(viewer)` through `Effect.either` ~86-89, `viewer` import ~10)

### Approach
- `src/app.tsx:14-16` already declares `guarded = [viewer, signedIn]` and settings uses it (~27); `src/pages/layout.tsx:13-25` defines both loaders; the editor already reads `signedIn` (`src/pages/loaders.ts` ~85).
- With `signedIn` the value is a non-null `Account`: the `Either.isLeft` branch and the empty-fragment branch can go. Keep error handling the page still needs for `NetworkError` and `DecodeError` per the layout notes if `signedIn` can still fail with them.
- The regression test is the existing `apps/realworld/test/auth.test.ts` case "register, update settings, log out and log in" (asserts `['/', ANONYMOUS, '']` after logout); it needs no change and must pass.

### Investigation targets
**Required**:
- `apps/realworld/src/pages/settings.tsx`, `apps/realworld/src/pages/layout.tsx:1-30`, `apps/realworld/src/app.tsx:10-40`
- `apps/realworld/test/auth.test.ts:100-140`

### Acceptance
- [ ] Settings reads `signedIn`; no workaround comment or `Either` branch remains
- [ ] Logout from settings lands on `/` (the existing auth test passes unchanged)
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` green; `pnpm format:check` clean

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
