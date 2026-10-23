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
- Generate the composed Layer in the analyzer's order (path codepoint), providing the generated implementation Layers and shadowed by the explicit `layer`; a failing Layer build fails the first request and every later one with the same cause, never a half-built app. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1, .7 and .8. `virtual:sleek/server-app` is `appCode` (`server-services.ts:320-368`) behind the `SERVER_APP` branch of `load` (`:532-536`): add the fields to its default export beside `controllers` (the `DiscoveredApp` that task 3 extends), reading nothing from a virtual module at top level. `start` imports it only on the first request, so a Layer File that reads `process.env` reads it then. Layer Files are not found by `discoverControllers`, which scans the files under `serverDir` and `controllersDir` (`filesUnder`, `:226-230`); they sit anywhere in the TS program, so take them from the analyzer's Layer File pass (task 1) and join them to the discovery memo (`discovery()`, `:439`). `start` calls `configureRuntime` at the `start()` call today (`start.ts:137-141`); task 3 moves it to the first request, which is what lets the composed Layer and `onError` in -->
- Emit the Server Root's `onError` (default `console.error`).
- Dev and build: `*.layer.ts` and `_app.ts` add, remove, rename and edit regenerate and invalidate the modules; the declaration is sorted and a stale one fails `vite build`; works under vitest. Tests that read env at Layer File import set it before importing the app (realworld pattern). <!-- Updated by plan-sync: fn-68-file-routed-controllers.7: the dev handler (`changed`, `server-services.ts:556-581`) invalidates `virtual:sleek/server-app` only when the `discovered` result differs before and after or `discoveryFile` (`:570-572`) holds. That predicate and `server.watcher.add([serverDir, controllersDir])` (`:584`) cover only `*.controller.ts` and `_defaults.ts` under `serverDir` or `controllersDir`. A Layer File edit leaves the generated code as it was, and a `*.layer.ts` can sit anywhere in the program, so widen `discoveryFile` to `*.layer.ts` anywhere and `_app.ts` under `serverDir`, and watch their directories. Reset each new memo in `configResolved`, the build-mode `watchChange` and each `changed`. An analyzer error of the new pass fails the module load with `file:line`, as `discover()` does (`:425-438`), and the previous declaration stays; the bundled `analyze()` plugin runs no Controller pass, so it will not run this one either (`analyze.ts` is unchanged) -->

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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
