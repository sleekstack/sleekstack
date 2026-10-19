---
satisfies: [R6, R8]
---
# fn-59-docs-build-platform-on-ui-and-start.5 ui-vite: static prerender build and the search index

## Description
The production build: one HTML file per route with content and head tags plus the client bundle, and the build-time search index with its browser search function. This is the spec's end-to-end proof: a built page serves from a static file server and hydrates.

**Size:** M
**Files:** packages/ui-vite/src/prerender.ts, search.ts, search-client.ts, index.ts, tests in packages/ui-vite/src/__tests__/; a small fixture content directory under the package tests
**Touches:** [packages/ui-vite/**]

### Approach
- Prerender: for each route run the page through the router and `renderToString` (or stream) with the head collected into the document shell; write `index.html` per route plus the client entry bundle; follow the static-generation spec's shape (fn-30): a render or compile error fails the build naming the route.
- Hydration: the client entry uses `hydrateMount`; the test serves the output with a plain static file server and hydrates a page in jsdom with no `HydrationMismatch`.
- Search index: written at build from title, headings and text of the guides and API pages; the browser function takes the index and a query and returns ranked results (title, anchor, snippet); an empty query returns none; a missing index is an error; the build prints the index size.
- Production output must not import `@sleekstack/start`.

### Investigation targets
**Required**:
- `.flow/specs/fn-30-static-site-generation.md`
- `packages/router/src/server.ts` (`handle`), `packages/ui/src/hydrate.ts` (`hydrateMount`)
- `packages/ui-vite/src/` from tasks .3 and .4, and `packages/ui/src/head.ts` from tasks .1 and .2
- `apps/showcase/vite.config.ts`, `apps/showcase/src/main.tsx` (a ui entry that hydrates)
**Optional**:
- `.flow/charts/fn-57/5.md` (search decision), `.flow/charts/fn-57/7.md` (hosting)

## Acceptance
- [ ] A build writes one HTML file per route (content and head tags) and the client bundle; the output serves from a static file server and a page hydrates with no mismatch
- [ ] A render or compile error fails the build naming the route
- [ ] The search index is written and the client function returns ranked results offline; empty query returns none; a missing index is an error; the size is printed
- [ ] Production output does not import `@sleekstack/start`
- [ ] `pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...` is green

## Done summary
ui-vite static build: `sleekContent({ prerender: { server, client }, search })` writes one index.html per route (head tags, stylesheet, client script), the client bundle, search-index.json (size logged) and the stylesheet last. Errors name the route. Browser search client at packages/ui-vite/src/search-client.ts (export `@sleekstack/ui-vite/search-client`). Tier: implementer opus at medium. Review skipped by standing user rule (REVIEW_MODE none).

stage: impl-review - skipped(config: standing user rule, no per-task review)
## Evidence
- Commits: 3a23866430711e3a4a9fea5ca2d9a6f001a704b3
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite..., pnpm format:check
- PRs: