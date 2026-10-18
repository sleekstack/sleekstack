---
satisfies: [R3]
---
# fn-29-sleekstack-vite-plugin.4 File-based routes to @sleekstack/router table

## Description
Scan `routesDir`, emit a virtual module exporting a const route table for `routes()` (`packages/router/src/index.ts:19`); params stay inferred from path strings. Add/rename/delete updates via HMR invalidation without restart. No TanStack generator (ADR 0036).

**Size:** M
**Files:** packages/ui-vite/src/routes.ts, src/__tests__/routes.test.ts
**Touches:** [packages/ui-vite/src/**]

### Approach
- Virtual module + `handleHotUpdate`/watcher invalidation.
- Invalid route file error names its path.

### Acceptance
- [ ] Tree consumed by router, updates on add/remove (R3)
- [ ] Invalid route file reports its path (R3)

## Acceptance
- [ ] TBD

## Done summary
Added `routes()` to `sleekstack()` (`packages/ui-vite/src/routes.ts`). It serves `virtual:sleekstack/routes`, which exports `table`, a `@sleekstack/router` route table built from the files under `routesDir` (default `src/routes`), and `pages`, each file's default export keyed by route name. A route's name is its file path without the extension. `users/[id].tsx` becomes `/users/:id`, and an `index` file takes its directory's path. Static segments sort before params so `match` picks them first. The plugin writes the module's types to `routes.gen.d.ts` inside `routesDir`: literal paths, so `Params` infers params from them as it would from a hand-written table, plus each page's type. In dev, adding or removing a route file invalidates the module in every environment, rewrites the declaration and triggers a full reload. `routesDir` is also added to the watcher, so a directory outside the Vite root is watched. An invalid segment, or two files with the same path, fails the module load with an error that names the file. `src/__tests__/routes.test.ts` covers the router matching the table, the TS consumer typecheck, add and remove with real fs events, and both invalid-file cases (R3 error case).

Follow-ups: task 6's ADR note should record that the plugin writes `routes.gen.d.ts`. It is a declaration only with no runtime code, but ADR 0036 says "no code generation". Apps may want to gitignore that file.
Deps: added `@sleekstack/router` (workspace) as a devDependency of ui-vite, with the matching lockfile entry.
baseline: not run pre-edit (worker omission); post-change Quick command green
stage: impl-review - ran (codex fan-out NEEDS_WORK with 3 findings, fixed, then SHIP on re-review)
## Evidence
- Commits: e1de5ab5ddb88db3470eba875d32302f213cc753, 74003b52e45c02b552694f875f90a6e3364cc767
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...
- PRs: