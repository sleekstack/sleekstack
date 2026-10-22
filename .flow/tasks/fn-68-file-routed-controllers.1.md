---
satisfies: [R10, R11]
---
# fn-68-file-routed-controllers.1 start+ui-vite: start() reaches virtual:sleek/server-app (spike) and the discovered-app contract

Touches: [packages/start/src/**, packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/**]

## Description
Build and prove the seam every later task uses: `start()` reads the discovered app from `virtual:sleek/server-app`, which the plugin serves. This is the mechanism half of R10 and R11 and it fixes the entry contract that tasks 5-9 and the sibling spec consume.

**Size:** M
**Files:** `packages/start/src/start.ts`, `packages/start/src/app.ts` (new: discovered-app and Controller entry types), `packages/start/src/index.ts`, `packages/start/src/__tests__/start.test.ts`, `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture under `packages/ui-vite/src/__tests__/fixtures/`

### Approach
- Make `StartOptions.router` optional (`start.ts:28-50`; keep `layer.test-d.ts` green) and add the discovered-app slot at the merge point `start.ts:75-88`. Load it lazily on the first `fetch` with a dynamic `import('virtual:sleek/server-app')`, never at module top level. With nothing discovered and no explicit option the first request fails with a message naming the plugin (R11).
- Serve a minimal `virtual:sleek/server-app` (an empty app) from the `serverServices()` plugin, following the virtual-module and declaration patterns at `server-services.ts:171-284` and `:118-135`; add an ambient `declare module` for it in start.
- Run the mechanism in three contexts with `start` as a workspace link: `ssrLoadModule` (the pattern at `server-services.test.ts` ~:178), a vitest run, and `vite build --ssr`; run it once more with start externalized. Record whether zero-argument `start()` or an app passed in (`start(app)`) works. If neither does, keep the fallback: the plugin emits one module that calls `start` and the server entry re-exports it. Write the outcome in the done summary.
- Define the entry contract in `app.ts`: per Controller a route name, URL pattern, per-method Schemas (params, query, body, success) and the option chain (`wrap` list, `bodyLimit`, `origins`), plus the optional page router.

### Investigation targets
**Required** (read before coding):
- `packages/start/src/start.ts:15-50,75-113` - options, merge point, pipeline
- `packages/ui-vite/src/server-services.ts:171-284` - plugin, virtual modules, dev handler
- `packages/ui-vite/src/__tests__/server-services.test.ts:143-200` - scaffold and createServer helpers
- `.flow/memory/bug/integration/lazy-file-routes-links-need-code-2026-10-21.md` - read virtual exports only inside functions
- `.flow/memory/bug/integration/node-loaded-packages-vite-plugins-need-2026-10-18.md` - NodeNext, `.js` relative imports

**Optional**:
- `packages/start/src/__tests__/layer.test-d.ts`
- `packages/testing/src/serverFn.ts:25-33`

### Key context
- `@sleekstack/start` resolves to its `dist`; its own tests run without the plugin, so the import must be lazy and its failure must be the clear error, never an import-time crash.
- After building a package, check that `dist/index.js` imports in plain Node (`node --input-type=module -e`, per the memory entry).

## Acceptance
- [ ] `start()` with no router and an empty discovered app serves 404 for pages, in `ssrLoadModule`, vitest and `vite build --ssr` (R11)
- [ ] with nothing discovered and no options the first request fails with a message naming the plugin
- [ ] the outcome (zero-argument vs app-passed form, externalization result, fallback if needed) is in the done summary
- [ ] the entry contract types are exported with TSDoc and an `api-coverage` entry
- [ ] the fixture graph check output is identical before and after
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
