---
satisfies: [R1, R2, R12]
---
# fn-69-server-auto-wiring.6 ui-vite: Layer File and Server Root composition into the discovered app

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/**]

## Description
Emit the composed Layer of the Layer Files and the Server Root's `onError` into `virtual:sleek/server-app`, with dev parity for the new kinds (R1, R2, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture `layer-files/`

### Approach
- Generate the composed Layer in the analyzer's order (path codepoint), providing the generated implementation Layers and shadowed by the explicit `layer`; a failing Layer build fails the first request and every later one with the same cause, never a half-built app. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1, .7 and .8. `virtual:sleek/server-app` is `appCode` (`server-services.ts:320-368`) behind the `SERVER_APP` branch of `load` (`:532-536`): add the fields to its default export beside `controllers` (the `DiscoveredApp` that task 3 extends), reading nothing from a virtual module at top level. `start` imports it only on the first request, so a Layer File that reads `process.env` reads it then. Layer Files are not found by `discoverControllers`, which scans the files under `serverDir` and `controllersDir` (`filesUnder`, `:226-230`); they sit anywhere in the TS program, so take them from the analyzer's Layer File pass (task 1) <!-- Updated by plan-sync: fn-69-server-auto-wiring.1 built it as `analyzeLayerFiles({ project, serverDir? })` (exported from `index.ts`) returning `{ layerFiles, serverRoot, errors }`: `layerFiles` is `{ file, location, provides, requires }[]` already in composition order (providers first, independent files by path codepoint, a cycle last), `file` relative to the tsconfig directory; `serverRoot` is `{ file, onError }` or undefined. Tags are names only (strings), so the generated code gets each Layer from `file`'s default export. `readLayerFiles(sources, checker)` (`layerFiles.ts:30`) is the unexported-from-index reader the Controller pass uses --> and join them to the discovery memo (`discovery()`, `:439`). `start` calls `configureRuntime` at the `start()` call today (`start.ts:137-141`); task 3 moves it to the first request, which is what lets the composed Layer and `onError` in -->
- Emit the Server Root's `onError` (default `console.error`). <!-- Updated by plan-sync: fn-69-server-auto-wiring.3 already did the start side: `DiscoveredApp` has optional `layer?: Layer<any, unknown>` (the Layer Files composed by requirement, not including generated implementation Layers, which come from `services`) and `onError?: ErrorSink`; `start` composes Layer Files, generated Layers and the explicit `layer` and calls `configureRuntime` in the memoized first-request load, with an explicit `layer` or `onError` winning. Emit the fields only; also fill `LayerFileServices` (each provided Tag, key to Tag type) in the generated declaration, which `StartOptions` excludes from `Needs`. Shadowed Layer Files are still built -->
- Emit the generated Layer Files' `layer` and `onError` as the fields above.
- Dev and build: `*.layer.ts` and `_app.ts` add, remove, rename and edit regenerate and invalidate the modules; the declaration is sorted and a stale one fails `vite build`; works under vitest. Tests that read env at Layer File import set it before importing the app (realworld pattern). <!-- Updated by plan-sync: fn-68-file-routed-controllers.7: the dev handler (`changed`, `server-services.ts:556-581`) invalidates `virtual:sleek/server-app` only when the `discovered` result differs before and after or `discoveryFile` (`:570-572`) holds. That predicate and `server.watcher.add([serverDir, controllersDir])` (`:584`) cover only `*.controller.ts` and `_defaults.ts` under `serverDir` or `controllersDir`. A Layer File edit leaves the generated code as it was, and a `*.layer.ts` can sit anywhere in the program, so widen `discoveryFile` to `*.layer.ts` anywhere and `_app.ts` under `serverDir`, and watch their directories. Reset each new memo in `configResolved`, the build-mode `watchChange` and each `changed`. An analyzer error of the new pass fails the module load with `file:line`, as `discover()` does (`:425-438`), and the previous declaration stays; the bundled `analyze()` plugin runs no Controller pass, so it will not run this one either (`analyze.ts` is unchanged) -->

<!-- Updated by plan-sync: fn-69-server-auto-wiring.5: `discoveryFile` (`server-services.ts:724-726`) already admits `RESERVED` basenames (`_defaults.ts`, `rpc.ts`, `_app.ts`) and `*.rpc.ts` under `serverDir` or `controllersDir`, so only `*.layer.ts` anywhere in the program (and its directory on the watcher, `:738`) is new. `appCode` now emits `limits` (when any RPC service exists) and `manifest` helper consts before `const controllers`, and each service entry's `layer` is `serviceLayer(Tag, { methods }, own.wrap)`; add `layer`/`onError` to the default export beside `controllers` and `get services()` without touching those. `readRpc`'s dirs argument gained `routesDir`; the declaration already has a separate `declare module 'virtual:sleek/server-app'` block for `GeneratedServices`, so `LayerFileServices` goes in the same style -->

- Keep the Layer-File exclusion (`__tests__/`, `test/`, `tests/`, `*.test.*`, `*.spec.*`) identical to the analyzer's by consuming the shared predicate.

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:187-216,320-368,414-588` - the analyzer route, `appCode`, the discovery memo and the plugin hooks
- the analyzer's Layer File pass (task 1)
- `apps/realworld/server/app.ts:28-35` - what the composition replaces

**Optional**:
- `.flow/memory/bug/integration/vite-plugin-memo-must-reset-per-build-2026-10-18.md`

## Acceptance
- [ ] a fixture app with three Layer Files and an explicit `layer` runs through `start()` with no Layer list; the explicit `layer` shadows a Layer File's Tag
- [ ] a failing Layer build fails every request with the same cause
- [ ] a Layer File under `test/` is not composed; dev add/remove/edit tests pass
- [ ] the committed declaration is sorted and typechecks
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Done summary
`virtual:sleek/server-app` now carries `layer` and the Server Root's `onError`. `layer` holds the Layer Files from the analyzer's `analyzeLayerFiles`, folded in its composition order with `Layer.provideMerge(next, before)` behind a memoized getter. `onError` is the `_app.ts` export, emitted only when it exists, so `start`'s `console.error` default stands otherwise. The declaration fills `LayerFileServices`, sorted by file, typing each Layer File as `Layer.Layer.Success<typeof import(file).default>`. It is keyed by file, not by Tag: the analyzer gives Tag names only, and `start` reads only the union of the values. An analyzer error fails the module load with `file:line`, and the previous declaration stays. In dev, a `*.layer.ts` change outside tests regenerates and invalidates the app. The check uses the analyzer's `TEST_FILE`, the same predicate the pass applies. The Layer Files' directories are added to the watcher.

Tests (`packages/ui-vite/src/__tests__/server-services.test.ts`, describe 'Layer Files', fixture `fixtures/layer-files/`):
- three Layer Files (one outside `server/`) are composed by requirement; `src/test/db.layer.ts` is not composed; the explicit `layer` shadows `Config` (`"hi / hello, ann"`)
- a failing Layer File build answers 500 twice, and the Server Root's `onError` gets the same cause each time
- the committed declaration is sorted and types the explicit `layer` (a `start({ layer })` that requires a Layer File output typechecks; an unprovided requirement is a type error)
- in dev: an add, edit or remove, an `_app.ts` edit, and an invalid file (keeps the declaration; the load names `file:1 ServerFileShape`); an edit under `test/` invalidates nothing

An app without a `tsconfig.json` skips the Layer File pass (it has no program). The first full gate run caught this in the ids, jsx and prerender fixtures, and the follow-up commit fixed it.

Note: the doc comment for `LayerFileServices` in `packages/start/src/server-app.ts` says "by key". That file is outside this task's Touches, so I left it unchanged.

Gates (serial, `--concurrency=1`; the first parallel run timed out in showcase under load): the main turbo test+typecheck, `realworld check`, docs test+typecheck+build, `pnpm --filter docs test`, `pnpm --filter docs build`, `pnpm format:check`, and the fixture graph check all passed. No public export changed.

baseline: green (ui-vite test+typecheck, turbo cache, pre-edit)
stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
Tier: session (jev-unavailable(no_key)); routing block sets opus at medium
## Evidence
- Commits: 597df2d3ec328e5bf6840eef39d2d775dd2cc33b, 88e22e5ea4bb5fb4115a122766262a7c26be5c89
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld --filter=showcase --concurrency=1, pnpm --filter realworld check, pnpm turbo run test typecheck build --filter=docs --concurrency=1, pnpm --filter docs test, pnpm --filter docs build, pnpm format:check
- PRs: