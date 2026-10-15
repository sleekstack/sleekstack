---
satisfies: [R7, R8, R9, R10, R11]
---
# fn-51-showcase-one-app-for-all-of-sleekstackui.4 Showcase demos: Portal, Boundary reset, router, devtools, testing, README

## Description
Add demos for Portal, Boundary reset, @sleekstack/router (loader, Link, prefetch), the devtools panel (dev only) and a component test with @sleekstack/testing; write apps/showcase/README.md listing every demo and how to run it; link it from the root and package READMEs. **Touches:** apps/showcase/**, README.md

## Acceptance
- R7 (rest), R8, R9, R10 hold
- showcase README lists every demo; turbo test/typecheck for showcase and docs green

## Done summary
The shell now links four more pages:
- Portal (`pages/portal.tsx`): a dialog rendered into `document.body` that reads the `Viewer` of its position.
- Boundary reset (`pages/boundary.tsx`): each visit's first read fails, and the fallback's `reset` re-runs the children.
- Router (`pages/router.tsx`): a `@sleekstack/router` app that `startRouter` runs in the page's own container while it is open. It has a `const` table, a loader with a schema, declared on the page under `Pending`, and real `Link`s that prefetch on hover or focus.
- Devtools (`pages/devtools.tsx`): links the dev-only panel, which `src/devtools.tsx` now mounts at `#devtools`.

`apps/showcase/README.md` lists every page with its source and test, how to run, build, test and check the app, and its known limits. The root README, the ui, analyze, router, testing and devtools READMEs, and `showcases.mdx` link it.

Tests:
- `test/portal.test.ts`, `test/boundary.test.ts`, `test/devtools.test.ts` and `test/router.test.ts` use `@sleekstack/testing` (`render`, `flush`; `mockLayer` for `UserRepo` in the router test).
- Portal, boundary and devtools tests cover mount, `renderToString` and hydration. The devtools test also covers the production branch through `vi.stubEnv`.
- The router test covers hover prefetch (the navigation reads the prefetched result), a navigation that waits for its loader, and `handle` on the server. It also covers `startRouter` hydrating that HTML without loading again.
- `test/app.test.ts` walks the shell through all nine pages.

`@sleekstack/router` is a new dependency and `@sleekstack/testing` a new devDependency. The lockfile gained only those two edges; a stray `apps/sleek-codes` importer was removed. The pages rule in `test/architecture.test.ts` allows `@sleekstack/router`. The ADR 0022 size entries did not move. `sleekstack check` is clean with 4 trees, and the production build contains no devtools.

Review: the first round flagged that the router page wrote out `Link`'s anchor instead of using `Link`. `sleekstack check` reports a `<Link>` in any tree it walks as `Unresolved`, because the analyzer does not read `@sleekstack/router`. The fix runs the routed pages through `startRouter`, which is not an analyzer root. Those pages are therefore outside the component pass; the README says so.

Changed route: the shell has four new pages (Portal, Boundary reset, Router, Devtools). The Router page's links change the address bar (`/people/:id`), and its team route is `/`.

Follow-ups (not built):
- Analyzer support for `@sleekstack/router`: read `Link`, and treat `startRouter` / `router()` pages as roots. This is a package change, out of scope under R11.
- The `hydrateMount` atom-bound text bug from task 3 is still open; the README lists it under known limits.

Tier: implementer opus at medium (actual_model: claude-opus-5-5)

baseline: green (pnpm turbo run test typecheck --filter=showcase --filter=docs; sleekstack check clean, pre-edit)

stage: impl-review - ran (codex fan-out, base master: correctness, contracts and integration all NEEDS_WORK on one shared finding, router demo not using Link; fixed in 0f6364d; re-review SHIP)
## Evidence
- Commits: 389a528653a4cc18203464b4f5d25f8ce50e925b, 0f6364dcc9dd149cbc602033adc5412bd2b0c2b8
- Tests: pnpm turbo run test typecheck --filter=showcase --filter=docs, pnpm turbo run test typecheck, pnpm --filter showcase build, pnpm --filter showcase check (sleekstack check: ok, 0 diagnostics, 4 trees)
- PRs: