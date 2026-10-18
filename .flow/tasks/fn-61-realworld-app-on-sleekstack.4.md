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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
