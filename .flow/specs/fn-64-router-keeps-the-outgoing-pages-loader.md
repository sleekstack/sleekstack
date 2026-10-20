## Goal & Context
<!-- scope: business -->

When a router navigation starts, `startRouter` drops every settled loader result. The page being left is still mounted for the whole navigation (the next page's loaders run first, then it is swapped in), and when it re-renders in that window its `useLoader` reads find nothing and run the loader again. The reload can run a server call for a page the user is leaving, and a loader that redirects (a sign-in guard) can fire from the outgoing page.

Found in the RealWorld app (fn-61, task 6): logging out from settings navigates to `/`, but the settings page re-ran its guard loader while the router was leaving it, and the logout landed on `/login`. The app works around it: settings reads the non-redirecting `viewer` loader instead of the `signedIn` guard, with a comment explaining why. After this spec a page that is being left keeps reading the results it already holds, and apps can put the same guard on every page without a workaround.

## Architecture & Data Models
<!-- scope: technical -->

- **Where it happens.** `go()` in the client history module deletes every held result that is neither loading nor an unread prefetch at the start of each navigation ("each navigation loads again"). The page shown stays mounted until the swap (`show`), and `useLoader` treats a missing key as "run the loader" and holds the new result.
- **Reproduce first.** The first task writes a failing router test: a mounted page re-renders during a pending navigation and its loader must not run again. The cause above is read from the code and the task 6 report, not yet confirmed by a test.
- **The rule: stale, not deleted.** At the start of a navigation the router records the held results that are settled and not unread prefetches (today's drop set) as stale, and deletes nothing. The incoming page's `resolve` reads a stale result as a miss: it loads fresh and replaces the entry when the load settles, so the key is never empty and the page being left keeps reading the old value until the new one lands (this also covers a navigation to the same pathname). Only `resolve` sees the stale record, so mounted pages are unaffected. Once the swap is committed (after `show` returns, and only if this navigation is still the current one) every record entry that was not replaced is deleted, so an undeclared read by the shown page still loads fresh, as it does today.
- **Redirect chains.** `resolve` follows redirects in one pass; entries created for an intermediate hop's pathname (results and held failures) are deleted at commit, keeping only the shown page's pathname.
- **Superseded and failed navigations.** A navigation that is interrupted, ends in an external assign, a redirect loop or a defect never commits and therefore deletes nothing; the stale record is simply replaced by the next navigation's. The next committed navigation clears what is left, so the map stays bounded.
- **Keys ignore the search string** (loader key plus pathname), as today: a navigation between two searches of one pathname is a same-key navigation and follows the rule above.

## API Contracts
<!-- scope: technical -->

No public API change. `useLoader`, `loader`, `prefetchLoader`, `Loaders`, `startRouter` and `handle` keep their signatures. Behavior change: when held results are dropped. The server path (`handle`) is unaffected.

## Edge Cases & Constraints
<!-- scope: technical -->

- **Same-pathname navigation** (a link to the page already shown, a form action that navigates back to it, or a change of search string only): the incoming `resolve` loads fresh and replaces the entry at settle; the outgoing instance keeps the old value until then and sees the new one after. Never an empty key in between. Test it.
- **Back and forward** (`pop`): same rule as push.
- **Redirects:** a guard's redirect while resolving still navigates (a `Redirect` keeps its existing behavior); only the outgoing page's reads stop redirecting.
- **Prefetch:** unread prefetches (with their expiry) are never in the stale record and are unchanged; a read by a page keeps the result, and a prefetch of the incoming path serves the navigation instead of loading again.
- **In-flight loads:** a load in flight when a navigation starts is kept, as today, and the commit-time deletion never touches an entry that is loading.
- **Failed loads:** a held failure is replayed once by the next read, as today.
- **Hydration:** unchanged; the first page adopts the server's results and runs no loader.
- Memory must not grow: after each committed navigation the map holds only the entries loaded or replaced by that navigation, unread prefetches and in-flight loads. The commit-time deletion runs after the async `show` returns and checks the navigation is still current, so a newer navigation's entries are never deleted by an older one.
- Mid-mount re-reads: a read by the page being mounted during `show` sees the new entries; the old page, once replaced, no longer reads.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A page being left that re-renders during a pending navigation reads its held loader results and runs no loader and no redirect. Errors: a loader that would redirect is not run by the outgoing page; a held failure is replayed once.
- **R2:** Each navigation still loads its own page's loaders fresh, including a navigation to the same pathname and back/forward. Errors: a loader failing on the incoming page shows that page's boundary as today; a redirect from an incoming guard still navigates.
- **R3:** After a navigation commits, results that were stale and not replaced, and entries for intermediate redirect hops, are deleted (the map is bounded across many navigations); an interrupted, failed or external navigation deletes nothing of the page still shown. Errors: a newer navigation interrupting an older one leaves the shown page's results readable and is not pruned by the older one's commit; a held failure for the shown page is still replayed once.
- **R4:** `apps/realworld` settings uses the `signedIn` guard again and drops its workaround comment; logging out from settings lands on `/`, covered by the existing auth test. Docs: the router README states when held results are dropped. Errors: none beyond R1-R3.

## Early proof point
<!-- scope: technical -->

Task fn-64-router-keeps-the-outgoing-pages-loader.1 validates the core approach (stale-and-replace keeps the outgoing page reading without breaking fresh loads). If it fails, re-evaluate a navigation-scoped results map swapped at commit before fn-64-router-keeps-the-outgoing-pages-loader.2.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=realworld`

## Boundaries
<!-- scope: business -->

Out of scope: search-param routing, loader invalidation APIs, caching beyond what exists (prefetch expiry), changes to `handle`, and any change to how `Link` prefetches.

## Decision Context
<!-- scope: both -->

Raised by fn-61 task 6 (RealWorld app). Rejected "never drop results, invalidate by key": it changes the "each navigation loads again" rule and needs an invalidation API nobody asked for. Rejected keeping the workaround in apps: every guarded page would need to know the router leaves its loader unreadable mid-navigation.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | A page being left that re-renders during a pending navigation reads its held loader results and runs no loader and no redirect. Errors: a loader that would redirect is not run by the outgoing page; a held failure is replayed once. | fn-64-router-keeps-the-outgoing-pages-loader.1 | — |
| R2 | Each navigation still loads its own page's loaders fresh, including a navigation to the same pathname and back/forward. Errors: a loader failing on the incoming page shows that page's boundary as today; a redirect from an incoming guard still navigates. | fn-64-router-keeps-the-outgoing-pages-loader.1 | — |
| R3 | After a navigation commits, results that were stale and not replaced, and entries for intermediate redirect hops, are deleted (the map is bounded across many navigations); an interrupted, failed or external navigation deletes nothing of the page still shown. Errors: a newer navigation interrupting an older one leaves the shown page's results readable and is not pruned by the older one's commit; a held failure for the shown page is still replayed once. | fn-64-router-keeps-the-outgoing-pages-loader.1 | — |
| R4 | `apps/realworld` settings uses the `signedIn` guard again and drops its workaround comment; logging out from settings lands on `/`, covered by the existing auth test. Docs: the router README states when held results are dropped. Errors: none beyond R1-R3. | fn-64-router-keeps-the-outgoing-pages-loader.2 | — |
