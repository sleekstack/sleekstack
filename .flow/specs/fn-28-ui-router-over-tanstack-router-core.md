## Goal & Context
<!-- scope: business -->

Apps need routing. Decision from the interview: `@sleekstack/ui-router`, a thin adapter over TanStack `router-core` (not TanStack Start), so route matching, loaders, search params and history come from a maintained core while rendering stays ours.

## Architecture & Data Models
<!-- scope: technical -->

- New package `packages/ui-router` depending on `@tanstack/router-core` (verify current API and version in task 1 with docs; do not assume).
- `Router` provider component puts the router in context (a `Tag`/`Layer`, per the repo's DI vocabulary); `Link`, `Outlet`, `useNavigate`/`useParams`/`useSearch` as host components/atoms. Router state is an atom so components re-run through the existing reactive path.
- Loaders run as Effects, integrate with `Pending` (loading state) and the error `Boundary`; the typed error channel of a loader joins the Analyzer's component tree.
- SSR: server creates a router per request, awaits loaders, serializes state for hydration; streaming integration follows the streaming spec.
- Link click uses a host `onClick` (fn-23) and `preventDefault`; keyed `Outlet` content keeps state across param changes only when intended (key by route id).

## API Contracts
<!-- scope: technical -->

`createRouter`, `Router`, `Link`, `Outlet`, `useNavigate`, `useParams`, `useSearch`; route definition shape follows router-core's, wrapped for Effect loaders.

## Edge Cases & Constraints
<!-- scope: technical -->

Not-found and redirect from loaders; scroll restoration; base path; modified-click/target=_blank passthrough; navigation during pending loader (latest wins).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Navigating via `Link` updates the DOM without a full page load, in jsdom.
- **R2:** Params and search params are typed and update components on change.
- **R3:** A loader's `R` and `E` appear in `sleekstack check` for the routes that use it.
- **R4:** Server render of a route awaits its loader; client hydrates to the same DOM.
- **R5:** Redirect and not-found from a loader work on server and client.
- **R6:** ui-demo gains two routes using it; docs page added.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui-router...`

## Boundaries
<!-- scope: business -->

No file-based routing (that is the Vite plugin spec), no TanStack Start.

## Decision Context
<!-- scope: both -->

Depends on Pending, hydration and the built package.
