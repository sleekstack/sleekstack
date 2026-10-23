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
- Scan `*.controller.ts` under `controllersDir` (default `<serverDir>/routes`), following the `scan` shape at `routes.ts:128-148`: the `_` rule, `index`, `(group)`, route name and path from the analyzer's derivation (task 4). A `*.controller.ts` outside the directory, an optional or splat segment that is not last, and a URL starting with `/_sleek/` fail the build naming the file. `serverDir` is already a plugin option (task 2: `ServerServicesOptions.serverDir`, resolved to an absolute path in `configResolved`, and passed to both `serverServices()` and `analyze()` by `sleekstack()`); this task adds only `controllersDir`, and a new option must reach every bundled plugin that reads it (memory `sleekstack-option-must-reach-every`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 added the `serverDir` option --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 built the derivation as `controllerRoute(controllersDir, file)`, exported from `@sleekstack/analyze` (both paths absolute): it returns `{ route, pattern }`, undefined under a `_` file or directory, and throws `sleekstack: invalid Controller file <file>: <why>` for a file outside `controllersDir`, a segment of no route form, or an optional or splat segment that is not last, so those build failures already name the file. The `/_sleek/` URL check is not in it and stays here. `analyzeControllers({ project, serverDir?, controllersDir? })` (relative to the tsconfig directory) returns `{ controllers, errors, checker }`; a `ControllerDecl` is `{ route, pattern, file (relative to the tsconfig directory), methods }`, with only the methods read without error, and a bad path is reported there as `Unresolvable` and skipped rather than thrown -->
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
`serverServices()` now discovers Controllers (R1, R2, R10). `discoverControllers` in `packages/ui-vite/src/server-services.ts` finds every `*.controller.ts` under the new `controllersDir` option (default `<serverDir>/routes`). It names each one with the analyzer's `controllerRoute`, sorts them with the page routes' match order, and gives each its `_defaults.ts` chain, outer first, from `serverDir` down (the analyzer's `wrapped` rule). A discovery error fails the load of `virtual:sleek/server-app` and names the files. The module still serves `export default { controllers: [] }`; task 8 emits the entries from `discoverControllers`.

- Errors, each naming the file: a Controller outside `controllersDir`, a non-last optional or splat segment, and a URL under `/_sleek/`. Two Controllers at one path, or a Controller at a page route's path (param names ignored, using `scan` and `sortKey` exported from `routes.ts`), name both files. `routes.ts` also exports `matchOrder`, which its own scan now uses, so it is the only sort.
- Interpretation of `/_sleek/`: under the `_` rule, the only way a Controller's URL could start with `/_sleek/` is a `_sleek` directory at the URL root (groups skipped). That directory would otherwise be ignored silently, so it now fails the build.
- Orphans are searched for under `serverDir` and `controllersDir` only. A `*.controller.ts` elsewhere in the project is reported by `sleekstack check` (`Unresolvable`), not by the plugin.
- Page routes are read from the new `routesDir` option, which comes in by making `ServerServicesOptions` extend `RoutesOptions`. They are scanned only when Controller files exist, so an app without Controllers never has its page directory read here.
- Declaration: one writer adds a `virtual:sleek/server-app` section, `export interface Controllers { readonly "<route>": "<pattern>" }`, in match order. It does not redeclare `default`. If either the discovery or the contract read fails, the whole previous file is kept. With no Controllers the text is byte-identical to before, so the committed `server.gen.d.ts` files of realworld, showcase and docs did not change.
- Dev: a Controller or `_defaults.ts` (under `serverDir` or `controllersDir`) added, removed, renamed or edited, or any change that alters the discovery result, invalidates `virtual:sleek/server-app` in every environment and sends a full reload. Discovery is recomputed on every change, so a new `_defaults.ts` re-resolves every Controller beneath it. The memo resets in `configResolved`, `watchChange` and each dev change. `serverDir` and `controllersDir` are added to the watcher.
- `analyze.ts` is unchanged. The bundled analyze plugin does not run the Controller pass, so it does not read `controllersDir`.

Tests (`server-services.test.ts`, "Controller discovery", 11 new tests, new fixture `fixtures/controllers/`): route names, patterns, match order, `index`, `(group)`, ignored `_` files and the defaults chain; one table case per error (orphan, non-last splat, `/_sleek/`, Controller vs Controller, Controller vs page), each checking the named files; a TypeScript consumer typechecked against the written declaration, merged with start's `default`; a dev sequence (add, edit, rename, remove a Controller, edit and add a `_defaults.ts`, plus an unrelated file that invalidates nothing); an invalid file keeping the declaration while the load reports its path; and `controllersDir` through both `serverServices()` and `sleekstack()`. I checked that each test can fail by breaking its piece of the implementation one at a time. Each mutation failed the matching test at the intended assertion.

Follow-ups, not built:
- The analyze plugin (dev overlay, build failure) does not report Controller diagnostics (`ControllerMethodShape`, `MissingDependency`). If task 8 wants them there, it can add `analyzeControllers({ project, serverDir, controllersDir })` and pass `controllersDir` from `sleekstack()`.
- `sleekstack check` cannot see `controllersDir` (the same gap as `serverDir`; task 12 docs).

Gates: baseline green via receipt 7938605d (only `.flow/` changed since). After the change, the full Quick command passed: 28 of 28 tasks, ui-vite 201 tests and realworld 155. `pnpm --filter realworld check` exit 0. Green receipt `.flow/tmp/green-receipts/4278e073-unittest.json`. Fixture graph check not run, because no public export name changed (`discoverControllers` is not exported from the package index).
GATE_SKIPPED:unittest:green-receipt 7938605d - baseline reused from prior post-gate pass

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - ran (sonnet; updated tasks 8, 10, 12)
## Evidence
- Commits: 4278e073927ea36a3497613976b1d5607ea0e74e
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, GATE_SKIPPED:unittest:green-receipt 7938605d - baseline reused from prior post-gate pass
- PRs: