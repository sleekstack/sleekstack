---
satisfies: [R11]
---
# fn-54-start-server-core-for-sleekstackui.5 showcase: a server-function page on the dev server, with a bundle test

## Description
Add a showcase page where a form adds an item through a server function served by the Vite dev server, a dev-server middleware that mounts `start(...)`, and the bundle test that proves the client chunk holds no server code.

**Size:** M
**Files:** apps/showcase/vite.config.ts, new apps/showcase/server/*.ts, new apps/showcase/src/pages/server.tsx, edit apps/showcase/src/app.tsx and shell nav, new test/server.test.ts, edit test/size.test.ts, README.md, package.json (dependency on `@sleekstack/start`)
**Touches:** [apps/showcase/**, pnpm-lock.yaml]

### Approach
- Mount `start(...).fetch` as Vite `configureServer` middleware (convert Node request to web `Request`); keep the react plugin config intact.
- The server module (services, the `serverFn`) lives outside `src/` so it never enters the client graph; the page imports it with `import type` and uses the client stub.
- Test the page with `@sleekstack/testing` against the handler directly (no network); add the bundle case to `size.test.ts` using its existing `measure` helper and the `@sleekstack/start` source alias.
- Add a README row. The architecture test must stay green.

### Investigation targets
**Required**:
- `apps/showcase/vite.config.ts`, `src/app.tsx`, `src/pages/router.tsx`, `src/pages/shell.tsx`
- `apps/showcase/test/size.test.ts` (`measure`, `sourceAlias`)
- `apps/showcase/test/architecture.test.ts` and `router.test.ts`
- `apps/showcase/README.md`
**Optional**:
- `packages/testing/src/render.ts`

## Acceptance
- [ ] The page's form adds an item through the server function; a test asserts the item appears and an invalid input shows the typed failure
- [ ] `vite` dev serves `POST /...` through `start(...)` (smoke test via the handler)
- [ ] The bundle test fails if the client chunk contains a server module or the server `Layer` graph, and passes now
- [ ] README lists the demo; the architecture test stays green; `pnpm turbo run test typecheck --filter=showcase` is green

## Done summary
The showcase has a "Server function" page (`src/pages/server.tsx`). Its form action is the `@sleekstack/start/client` stub built from the client-safe contract in `src/pages/items.ts`. `server/app.ts` builds `items.add` from that contract, together with a server-only `Items` Tag/Layer and the `start({ router: people, layer, functions })` entry. `server/dev.ts` turns a Node request into a web `Request` and mounts that entry as Vite `configureServer` middleware for `/_sleek/`; `vite.config.ts` loads it with `ssrLoadModule`.

Tests:
- `test/server.test.ts`: a form submit adds an item through `app.fetch` (no network). A duplicate shows the declared `DuplicateItem`, and an empty title shows `DecodeError` with no request sent. A second test smokes the dev middleware: a POST goes through start, and other paths reach `next`.
- `test/size.test.ts`: a new case builds `main.tsx`, the whole client graph, from dist and from source. It asserts the client holds `items.add` but none of the server-only markers: the `Items` Tag key, `sec-fetch-site` (origin.ts), `DuplicateServerFn` and `InvalidCookie`. The markers are first shown to be present in a build of `server/app.ts`.

The test was confirmed red: temporarily importing `server/app` from the page failed it. It passes now, so `wire.ts`'s endpoint is tree-shaken as task .4 expected and packages/start needs no packaging change. A manual Vite dev-server smoke returned 200 with a Success envelope, 403 cross-origin, and index.html for `/`.

Other edits: showcase depends on `@sleekstack/start` (the lockfile gains 3 lines, no sleek-codes entries). The tsconfig includes `server/`. The architecture rule lets `pages/` import `@sleekstack/start/client`. The README gains a demo row and a size-test note, and loses the stale "check does not read router pages" limit, which task .7 fixed. Prettier re-aligned the README tables.

baseline: green (`pnpm turbo run test typecheck --filter=showcase --filter=@sleekstack/start...`)
stage: impl-review - ran (codex fan-out --base master, all 3 draws SHIP with no findings; finalized via --merged-file because the integration draw's format did not parse for --merge-plan)
Tier: implementer opus at medium
## Evidence
- Commits: 9eb454a2b209bdb4c9a766d9970400a7f9e048ac
- Tests: pnpm turbo run test typecheck --filter=showcase --filter=@sleekstack/start...
- PRs: