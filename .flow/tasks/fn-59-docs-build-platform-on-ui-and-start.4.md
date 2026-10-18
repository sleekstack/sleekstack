---
satisfies: [R5, R7]
---
# fn-59-docs-build-platform-on-ui-and-start.4 ui-vite: route table, link validation and the dev entry

## Description
Generate the route table from the content tree and its order file, validate internal links and anchors at build, and serve the pages in development through the `start` fetch handler behind the Vite dev server.

**Size:** M
**Files:** packages/ui-vite/src/routes.ts, links.ts, dev.ts, index.ts (plugin entry), tests in packages/ui-vite/src/__tests__/
**Touches:** [packages/ui-vite/**]

### Approach
- Routes: content files plus the order file (the existing `meta.json` format) become a `@sleekstack/router` const route table; an optional base prefix is applied to every route; a file added, renamed or removed updates the table in dev without a restart.
- Link validation is the content-level logic of `apps/docs/scripts/check-links.mjs` (github-slugger heading ids, `/docs/<slug>` targets): port it as a build step; a broken link or anchor fails the build naming source and target. Heading ids must be the same as the MDX pipeline's, so test both against each other.
- Dev entry: follow `apps/showcase/server/dev.ts` (a Connect middleware turning requests into a web `Request` for `start(...).fetch`) and the router's `handle`; content changes reload; a content error shows in the overlay and clears when fixed.

### Investigation targets
**Required**:
- `apps/showcase/server/dev.ts`, `apps/showcase/vite.config.ts`
- `apps/docs/scripts/check-links.mjs`, `apps/docs/test/links.test.ts`
- `apps/docs/content/docs/meta.json`
- `packages/router/src/index.ts`, `server.ts` (route tables and `handle`)
- `packages/start/src/start.ts`
**Optional**:
- `.flow/specs/fn-29-sleekstack-vite-plugin.md` (routes and stable ids)

## Acceptance
- [ ] A route table is generated from a content tree and order file, with and without a base prefix; adding or removing a page updates it in dev
- [ ] A broken internal link or anchor fails the build naming source and target; heading ids match the MDX pipeline's
- [ ] In dev the pages are served by the `start` fetch handler behind Vite and update on content change; a content error appears in the overlay and clears on fix
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
