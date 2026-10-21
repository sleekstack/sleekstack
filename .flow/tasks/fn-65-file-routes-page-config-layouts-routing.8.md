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
`apps/playground/ui` now runs every file-route convention with nothing written by hand. `app.tsx` is `router({ table, pages, notFound })` from `virtual:sleekstack/routes`. The routes are a root `_layout`, a `(docs)` group with its own layout, a splat (`(docs)/guide/[...slug]`), an optional param (`posts/[[page]]`), a `_counter.tsx` helper, `_notFound.tsx`, and lazy client chunks. The ui-vite README "File-based routes" section is rewritten: conventions table, page config, layouts (they remount, and notFound gets none because the router runs no loaders for it), lazy pages, and the `Link` `code={pages[name].load}` pattern. The router README, `vite.mdx` and `routing.mdx` now match it, and `vite.mdx`'s stale "write pages out" analyzer note is gone. ADR 0050 now gives the notFound reason. It also records what the build changed: duplicate `_layout` files fail, client pages are `{ load }`, the `LazyLoadError` cases, routing listens only after hydration, and the stale-declaration and prerender consequences.

Bugs found in shipped code outside Touches. They are reported here, not fixed:
1. Prerender (`packages/ui-vite/src/prerender/enumerate.ts`) knows only `:param`. With `prerender: true`, a splat route `/guide/*slug` counts as static, and the build writes a junk `guide/*slug/index.html`. I saw this happen. An optional `:page?` route with a `prerender()` export throws "gave no 'page?'" (from reading the code). Without one it is skipped with a warning. The playground therefore uses a path list (`prerender: ['/', '/posts', '/posts/2', '/guide/intro']`), and the README, vite.mdx and ADR state the limitation. Fix: teach `isDynamic`/`fill`/`fills` about `?` and `*`.
2. `vite build` with a stale `routes.gen.d.ts` fails in the analyzer's `buildStart` and never rewrites the declaration. Two builds in a row both failed. Only `vite` (dev) rewrites it. A gitignored declaration therefore breaks a fresh-clone `vite build`. The README used to say "rewritten on build start", which is not true in effect. The docs now say to run `vite` once before `tsc` or `vite build`. Fix: write the declaration before the analyzer runs (plugin order, or the routes plugin's `configResolved`).
I checked the lazy paths in routes.ts against `resolve.ts`'s `codeOf` and found nothing wrong.

Deviations: `apps/playground/src/__tests__/ui-example.test.ts` (the playground's only test; it now covers `/posts`, `/posts/2`, `/guide/intro` under both layouts, and `_notFound` for `/nope` and `/_counter` with no layout). `apps/playground/README.md` (it described `prerender: true`).

baseline: green (`pnpm turbo run test typecheck build --filter=docs --filter=@sleekstack/ui-vite... --filter=sleekstack-playground`)
Gates: the same command is green after the change. `pnpm format:check` is clean. The spec Quick command was not re-run: the diff is docs and playground only, and none of its packages changed.

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out rid f39a238a19924d8ba0b9c21691067898: contracts SHIP, integration SHIP, correctness draw failed on model capacity; finalized SHIP)
## Evidence
- Commits: 1b59db0c3dfe3a4be74dbdd5787931fe36b3aa56
- Tests: pnpm turbo run test typecheck build --filter=docs --filter=@sleekstack/ui-vite... --filter=sleekstack-playground, pnpm format:check
- PRs: