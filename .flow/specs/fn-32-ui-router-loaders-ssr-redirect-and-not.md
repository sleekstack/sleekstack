## Goal & Context
<!-- scope: business -->

Second half of the router: Effect loaders, server rendering of a route and redirect/not-found, on top of fn-28's client router and the streaming spec.

## Architecture & Data Models
<!-- scope: technical -->

- Router-core loaders are Promise-based. The adapter wraps an Effect loader and runs it with a runtime built from the router's `Layer` (provided by the app next to `Router`); task 1 decides where that runtime lives and records it. Typed loader errors go to the nearest `Boundary`.
- Loading state uses `Pending` (fn-24); loaders use the waiting query primitive where they fetch.
- SSR: the server creates a router per request, awaits loaders, embeds dehydrated state (fn-25 format); the client hydrates (fn-25) to the same DOM. Streaming integration via `renderToStream` (fn-27).
- Redirect and not-found are thrown values router-core understands; the adapter maps them on server (status and `Location`) and client (navigate).

## API Contracts
<!-- scope: technical -->

Route option `loader: (ctx) => Effect<A, E, R>`; `useLoaderData`; server `handle(request)` returning a `Response`.

## Edge Cases & Constraints
<!-- scope: technical -->

Navigation during a pending loader (latest wins, fiber interrupted); loader failure on server vs client; redirect loops bounded; loader data survives hydration without refetch.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** An Effect loader runs on navigation and its data reaches the component; `Pending` shows during load. Errors: a typed loader error reaches the nearest `Boundary`.
- **R2:** Server render of a route awaits its loader; the client hydrates to the same DOM without refetching. Errors: a loader failure responds with the error status.
- **R3:** Redirect and not-found from a loader work on server (status, `Location`) and client. Errors: a redirect loop over the bound fails with a tagged error.
- **R4:** Superseded navigation interrupts the loader fiber and closes scopes, no leaked observers. Errors: none.
- **R5:** Streaming a route with a slow loader sends the shell first (needs fn-27).
- **R6:** ui-demo route uses a loader; docs page added.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui-router...`

## Boundaries
<!-- scope: business -->

No analyzer route support, no file-based routing, no deploy adapters.

## Decision Context
<!-- scope: both -->

Depends on fn-24, fn-25, fn-27 and fn-28.
