---
satisfies: [R7]
---
# fn-65-file-routes-page-config-layouts-routing.8 playground, docs and ADR 0050 on the new conventions

Touches: apps/playground/ui, packages/ui-vite/README.md, packages/router/README.md, apps/docs/content/docs/vite.mdx, apps/docs/content/docs/routing.mdx, docs/adr/0050-file-routes-layouts-and-lazy-pages.md

## Description
Make the playground the worked example of every convention (a layout, a group, a splat, an optional param, `_` helper, `_notFound`, lazy pages, no hand-written `pages` or table) and finish the docs.

**Size:** S
**Files:** `apps/playground/ui/src/**`, `packages/ui-vite/README.md`, `packages/router/README.md`, `apps/docs/content/docs/vite.mdx`, `apps/docs/content/docs/routing.mdx`, `docs/adr/0050-file-routes-layouts-and-lazy-pages.md`

### Approach
- Playground: `src/app.tsx` becomes `router({ table, pages, notFound })` from `virtual:sleekstack/routes`; add the routes needed to show each convention; its tests and `routes.gen.d.ts` (committed there, ADR 0045) updated.
- Docs: the ui-vite README 'File-based routes' section (`README.md:61-72`) lists conventions, page config, layouts (remount note, no `notFound` layout), lazy pages and the `Link` `code` pattern; drop the 'write pages out' note if task 4 has not. `vite.mdx` and `routing.mdx` match. Update the ADR with anything the build changed (status Accepted, built in fn-65).
- `apps/docs` builds with ui-vite: run its test, typecheck and build.

### Investigation targets
**Required**:
- `apps/playground/ui/src`, `packages/ui-vite/README.md:45-75`, `apps/docs/content/docs/vite.mdx`, `apps/docs/content/docs/routing.mdx`

### Acceptance
- [ ] The playground uses every convention with no hand-written table or pages and checks clean
- [ ] README, `vite.mdx`, `routing.mdx` and ADR 0050 agree with the shipped behavior; no hand-edited generated API docs
- [ ] `pnpm turbo run test typecheck build --filter=docs --filter=@sleekstack/ui-vite... --filter=sleekstack-playground` green; `pnpm format:check` clean

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
