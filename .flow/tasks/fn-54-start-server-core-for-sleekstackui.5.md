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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
