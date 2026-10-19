## Goal & Context
<!-- scope: business -->

When a router navigation starts, `startRouter` drops every settled loader result. The page being left is still mounted for the whole navigation (the next page's loaders run first, then it is swapped in), and when it re-renders in that window its `useLoader` reads find nothing and run the loader again. The reload can run a server call for a page the user is leaving, and a loader that redirects (a sign-in guard) can fire from the outgoing page.

Found in the RealWorld app (fn-61, task 6): logging out from settings navigates to `/`, but the settings page re-ran its guard loader while the router was leaving it, and the logout landed on `/login`. The app works around it: settings reads the non-redirecting `viewer` loader instead of the `signedIn` guard, with a comment explaining why. After this spec a page that is being left keeps reading the results it already holds, and apps can put the same guard on every page without a workaround.

## Architecture & Data Models
<!-- scope: technical -->

- **Where it happens.** `go()` in the client history module deletes every held result that is neither loading nor an unread prefetch at the start of each navigation ("each navigation loads again"). The page shown stays mounted until the swap (`show`), and `useLoader` treats a missing key as "run the loader" and holds the new result.
- **Reproduce first.** The first task writes a failing router test: a mounted page re-renders during a pending navigation and its loader must not run again. The cause above is read from the code and the task 6 report, not yet confirmed by a test.
- **The rule.** A navigation still loads its own page's loaders fresh: for the incoming path, held results are dropped before `resolve` runs. Results of the page being left stay readable by that page until the swap is committed; after the swap, results that neither the shown page nor an unread prefetch needs are dropped. Held results are keyed by loader key and pathname, so the two pages only share a key when the navigation is to the same pathname (see Edge Cases).
- **Interrupted navigations.** A newer navigation interrupts the older one. An interrupted navigation never commits, so it drops nothing of the page still shown.

## API Contracts
<!-- scope: technical -->

No public API change. `useLoader`, `loader`, `prefetchLoader`, `Loaders`, `startRouter` and `handle` keep their signatures. Behavior change: when held results are dropped. The server path (`handle`) is unaffected.

## Edge Cases & Constraints
<!-- scope: technical -->

- **Same-pathname navigation** (a link to the page already shown, a form action that navigates back to it): the incoming page's results for that path are dropped before `resolve`, so it loads fresh, as before; the outgoing instance reads the new result once it is held. State this and test it.
- **Back and forward** (`pop`): same rule as push.
- **Redirects:** a guard's redirect while resolving still navigates (a `Redirect` keeps its existing behavior); only the outgoing page's reads stop redirecting.
- **Prefetch:** unread prefetches (with their expiry) are unchanged; a read by a page keeps the result.
- **In-flight loads:** a load in flight when a navigation starts is kept, as today.
- **Failed loads:** a held failure is replayed once by the next read, as today.
- **Hydration:** unchanged; the first page adopts the server's results and runs no loader.
- Memory must not grow: after each committed navigation the map holds only results the shown page reads, prefetches and in-flight loads.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A page being left that re-renders during a pending navigation reads its held loader results and runs no loader and no redirect. Errors: a loader that would redirect is not run by the outgoing page; a held failure is replayed once.
- **R2:** Each navigation still loads its own page's loaders fresh, including a navigation to the same pathname and back/forward. Errors: a loader failing on the incoming page shows that page's boundary as today; a redirect from an incoming guard still navigates.
- **R3:** After a navigation commits, held results the shown page does not need are dropped (the map does not grow across many navigations), and an interrupted navigation drops nothing of the page still shown. Errors: a newer navigation interrupting an older one leaves the shown page's results readable.
- **R4:** `apps/realworld` settings uses the `signedIn` guard again and drops its workaround comment; logging out from settings lands on `/`, covered by the existing auth test. Docs: the router README states when held results are dropped. Errors: none beyond R1-R3.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=realworld`

## Boundaries
<!-- scope: business -->

Out of scope: search-param routing, loader invalidation APIs, caching beyond what exists (prefetch expiry), changes to `handle`, and any change to how `Link` prefetches.

## Decision Context
<!-- scope: both -->

Raised by fn-61 task 6 (RealWorld app). Rejected "never drop results, invalidate by key": it changes the "each navigation loads again" rule and needs an invalidation API nobody asked for. Rejected keeping the workaround in apps: every guarded page would need to know the router leaves its loader unreadable mid-navigation.
