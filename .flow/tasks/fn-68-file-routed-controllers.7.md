---
satisfies: [R1, R2, R10]
---
# fn-68-file-routed-controllers.7 ui-vite: Controller discovery, collisions, declaration and dev reload

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/routes.ts, packages/ui-vite/src/analyze.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/**]

## Description
Find the Controllers and `_defaults.ts` files, name and order them, and keep the declaration and dev server in step with them (R1, R2, R10).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/index.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, `packages/ui-vite/src/__tests__/routes.test.ts`, a new fixture `controllers/`

### Approach
- Scan `*.controller.ts` under `controllersDir` (default `<serverDir>/routes`), following the `scan` shape at `routes.ts:128-148`: the `_` rule, `index`, `(group)`, route name and path from the analyzer's derivation (task 4). A `*.controller.ts` outside the directory, an optional or splat segment that is not last, and a URL starting with `/_sleek/` fail the build naming the file. `serverDir` is already a plugin option (task 2: `ServerServicesOptions.serverDir`, resolved to an absolute path in `configResolved`, and passed to both `serverServices()` and `analyze()` by `sleekstack()`); this task adds only `controllersDir`, and a new option must reach every bundled plugin that reads it (memory `sleekstack-option-must-reach-every`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 added the `serverDir` option -->
- Collisions (R2): two Controllers differing only in param names, and a Controller and a page route with the same path, fail naming both; read the page routes through the existing scan helpers and compare with `sortKey` (`routes.ts:62-73`, export what is private). The plugin's sort is the single source of match order.
- `_defaults.ts` chain per Controller, outer first, following `layoutsOf` (`routes.ts:104-116`).
- Declaration: one writer for the Services and Controllers sections of the existing server declaration file (`server-services.ts:244-250`); write only when changed; keep the previous file when a scan fails. `@sleekstack/start` already declares `virtual:sleek/server-app` ambiently (`packages/start/src/server-app.ts`, default export `DiscoveredApp`), so the written declaration must not redeclare `default`; it may add named exports, for example entries typed by route name. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 shipped the ambient declaration and moved the server-services.ts references --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 moved them again --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 moved them again (printSchema gained the `ref` and string codec cases) -->
- Dev: add, remove, rename and edit of a Controller or `_defaults.ts` regenerate, invalidate `virtual:sleek/server-app` in every environment and full-reload (patterns `routes.ts:274-288`, `server-services.ts:300-325`, whose invalidation loop covers only `MODULES`, not `SERVER_APP`); a `_defaults.ts` change re-resolves every Controller beneath it. Reset any memo in `configResolved` and `watchChange` (memory). <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 moved the server-services.ts references again --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 moved them again -->

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/routes.ts:15-148,225-288`
- `packages/ui-vite/src/server-services.ts:200-327`
- `.flow/memory/bug/integration/virtual-module-needs-a-declaration-and-2026-10-18.md`
- `.flow/memory/bug/integration/vite-plugin-memo-must-reset-per-build-2026-10-18.md`

**Optional**:
- `.flow/memory/bug/integration/generated-slugs-must-not-collide-with-2026-10-18.md` - static before param

## Acceptance
- [ ] fixture tests: route names and paths, `index` and `(group)`, an orphan Controller, a non-last splat, `/_sleek/` URL, Controller-vs-page and Controller-vs-Controller collisions each naming both files
- [ ] a TypeScript consumer typechecks against the written declaration, not only through `ssrLoadModule` (memory)
- [ ] dev tests: add, remove, rename, edit a Controller, edit and add a `_defaults.ts`; each invalidates the module; an invalid file keeps the previous declaration and reports its path
- [ ] `serverServices()` standalone and `sleekstack()` both carry discovery
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
