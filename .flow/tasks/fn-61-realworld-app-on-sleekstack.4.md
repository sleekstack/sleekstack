---
satisfies: [R1, R3]
---
# fn-61-realworld-app-on-sleekstack.4 Server functions, cookie auth, SSR and dev server routing

Touches: apps/realworld/server/app.ts, apps/realworld/server/dev.ts, apps/realworld/vite.config.ts, apps/realworld/src/modules/*/contracts, apps/realworld/test/server*.test.ts

## Description
Expose every service as a `serverFn` with a contract in client-safe code and a union `error` Schema. Login/register/logout set/clear the `HttpOnly; SameSite=Lax; Path=/; Max-Age` cookie; others read it into `Viewer`. Build `start({router, layer, functions})` and generalize `server/dev.ts` (currently forwards only `/_sleek/`) to also serve `/api/*` and SSR'd pages through router `handle` with the `index.html` document.

**Size:** M
**Files:** `server/app.ts`, `server/dev.ts`, `vite.config.ts`, `src/modules/*/application/contracts.ts`, `test/server.test.ts`

### Approach
- Follow `apps/showcase/server/app.ts:12-22` and `server/dev.ts:12-32` (multi Set-Cookie handled at line 27).
- Origin check is enforced by start for `/_sleek/fn/*` (origin.ts:23-27); tests send Origin.
- Each server fn has a single error Schema: declare the union; undeclared failures are opaque 500.
- Router `handle(router, request, {layer, document})` at `packages/router/src/server.ts:60`; unmatched -> 404.

### Investigation targets
**Required**:
- `packages/start/src/start.ts:78-90`, `packages/start/src/wire.ts:77-101`, `packages/router/src/server.ts`
- `apps/showcase/test/server.test.ts:14-43`

### Acceptance
- [ ] Login sets cookie; protected fns without it return `Unauthorized`; logout clears it
- [ ] Cross-origin POST rejected (403); bodies over 1 MiB rejected
- [ ] Dev middleware serves an SSR page and an `/api/*` request

## Acceptance
- [ ] TBD

## Done summary
Every service is now a `serverFn` (20 functions) built in `apps/realworld/server/app.ts` from client-safe contracts in `src/modules/{identity,articles,comments}/application/contracts.ts`. Each contract has one declared error Schema: the union of the tagged errors that function can raise. Register and login set the session cookie `conduit_session` (`Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`, the token's own 30-day life). Logout clears it. Every other function, `tags.list` included, runs its service through `asViewer`, which reads the cookie into `ViewerLive`. A missing cookie gives an anonymous viewer, and a bad cookie gives `Unauthorized`. `start({router, layer, functions})` runs on `AppLive + DbLive(process.env.CONDUIT_DB) + TokenSecretLive`.

- The User success Schema `Account` = `User.omit('token')`, so server functions never hand the token to scripts. Encoding drops it, and the cookie is the only carrier.
- `server/dev.ts` sends `/_sleek/*`, `/api/*` and GET/HEAD navigations (`Accept: text/html`) to `start`. Everything else goes to Vite. An HTML answer is placed into Vite's transformed `index.html` at `<div id="app"></div>`; a replacer function keeps any `$` in the page literal. `vite.config.ts` registers the middleware directly in `configureServer`, so it runs before Vite's own index.html handler.
- Router: `server/app.ts` holds a placeholder one-route table (`/` -> `App`, notFound -> `App`). Task 6 replaces it with the real route table. `/api/*` currently gets the router's 404 page until task 5 mounts the REST middleware.
- I left the module `index.ts` files alone because they are outside Touches, and the server imports the contracts directly from `application/contracts`. Task 6 should re-export the contracts from each module `index.ts`, because pages may import modules only through it.
- Tests: `test/server.test.ts` (7 cases). They cover: login sets the cookie with the exact attributes; protected calls without it, or with a bad one (`user.current`, `tags.list`), return `Unauthorized`; logout sends `Max-Age=0`; register signs in; a wrong login is the declared Forbidden; article/follow/feed/comment flows run as the cookie viewer with typed Forbidden/NotFound; a cross-origin call gets 403; a body over 1 MiB gets 413; dev middleware serves `/` SSR'd inside the document and serves `/api/tags` through start; `/src/main.tsx` goes to Vite. Mutation checks: dropping `httpOnly`, dropping `/api/` forwarding, and dropping `asViewer` on tags each turned a test red.
- Live check: `vite --port 5199` served `/` with the rendered banner inside the document, and `POST /_sleek/fn/users.register` returned 200 with the Set-Cookie line.
- `baseline: green via handoff (verified at 22b686f by fn-61-realworld-app-on-sleekstack.3)`
- GATE_SKIPPED:unittest:green-receipt b9e3c904 - baseline reused from prior post-gate pass
- Follow-up (not built): `Secure` is not set on the cookie, because dev runs over http. A production entry should add it.
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out rid 25b6e772d9e0492bbacfb0c1b9b4699e NEEDS_WORK (tags.list skipped session check) -> fix b9e3c90 -> re-review SHIP)
## Evidence
- Commits: 9f4983885ecc0a0f9683cd4e4a3c446ddcfc3c22, b9e3c9048f4518cbdf885ff1e005b0799bb9e1d0
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check, GATE_SKIPPED:unittest:green-receipt b9e3c904 - baseline reused from prior post-gate pass
- PRs: