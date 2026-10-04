## Goal & Context
<!-- scope: business -->

Apps need routing. Decision from the interview: `@sleekstack/ui-router`, a thin adapter over TanStack `router-core` (not TanStack Start). This is the **client router** half: matching, history, `Link`, `Outlet`, typed params and search. Loaders, SSR, redirects and not-found are fn-32.

## Architecture & Data Models
<!-- scope: technical -->

- New package `packages/ui-router` depending on `@tanstack/router-core` (task 1 verifies the current API and version from its docs; do not assume).
- Router state is an atom: a router-core subscription mirrored with `store.set`, the way `query.ts` mirrors an observer, so components re-run through the existing reactive path.
- `Router` provider puts the router in context as a `Tag`/`Layer`; `Link` (host `onClick` + `preventDefault`), `Outlet` (key by route id), `useNavigate`/`useParams`/`useSearch`.
- Route definitions follow router-core's shape; components are ui components.
- The analyzer does not see routes (runtime data), so no analyzer work in this spec.

## API Contracts
<!-- scope: technical -->

`createRouter`, `Router`, `Link`, `Outlet`, `useNavigate`, `useParams`, `useSearch`.

## Edge Cases & Constraints
<!-- scope: technical -->

Modified-click and `target=_blank` pass through; base path; scroll restoration; navigation during a pending render is latest-wins; unknown route renders a configurable not-found component.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `Link` navigates without a page load and updates the DOM in jsdom. Errors: modified click and `target=_blank` are not intercepted.
- **R2:** Params and search params are typed and update components on change. Errors: an invalid param type fails typecheck (type test).
- **R3:** `Outlet` keyed by route id keeps node identity for unchanged parent layouts and remounts on a different route. Errors: none.
- **R4:** Unknown path renders not-found and a thrown render error reaches the nearest `Boundary`.
- **R5:** ui-demo gains two routes; a docs page is added in `apps/docs` under the ui section.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui-router...`

## Boundaries
<!-- scope: business -->

No loaders or SSR (fn-32), no file-based routing (fn-29), no TanStack Start, no analyzer route support.

## Decision Context
<!-- scope: both -->

Split from the original router spec after review: the original R3 (loader R and E in `sleekstack check`) is not achievable because the analyzer builds one static tree from JSX and routes are runtime data. Analyzer route support is out of this roadmap until someone specs it with its own ADR.
