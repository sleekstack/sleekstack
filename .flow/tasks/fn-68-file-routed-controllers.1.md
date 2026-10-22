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
`start()` now takes no options. On its first request it reads the discovered app, which the `serverServices()` plugin serves as `virtual:sleek/server-app`. For now the plugin serves an empty app. `router` is optional: with no router and no discovered router, every page answers 404. With no options and nothing discovered, every request fails with a message that names the plugin. The entry contract is exported with TSDoc and has API reference entries: `DiscoveredApp`, `ControllerEntry`, `ControllerMethodEntry` and `ControllerOptions`.

Spike outcome (the start package is a workspace link):
- The zero-argument `start()` works in all three contexts: `ssrLoadModule`, a nested vitest run and `vite build --ssr`. Each test in `packages/ui-vite/src/__tests__/server-services.test.ts`, under "the discovered app", gets a 404 for a page. The app-passed form `start(app)` was not built. It would work too, because the server entry's own `import app from 'virtual:sleek/server-app'` resolves even when start is externalized. The fallback (a generated entry that calls `start`) is not needed.
- The mechanism changed from the plan. A literal `import('virtual:sleek/server-app')` inside start broke every consumer that runs without the plugin. vitest's jsdom transform failed to resolve it, which failed all of `@sleekstack/testing`'s suites and start's own `client.test.ts`. `vite build --ssr` also failed in Rolldown. So start now imports a real stand-in, `packages/start/src/discovered.ts`, whose default export `undefined` means nothing is discovered. The plugin's `resolveId` (`order: 'pre'`) sends that import to `\0virtual:sleek/server-app`. Without the plugin, a build or a jsdom run of start works with explicit options, and with none it fails on the first request naming the plugin.
- Externalized start: both forms fail at import, before discovery matters. This was already true before this task: start's dist uses extensionless relative imports, so Node alone cannot load it (ERR_MODULE_NOT_FOUND for `./start`). Forcing `ssr.noExternal: ['@sleekstack/start']` from the plugin was tried and dropped. Vitest maps it to `server.deps.inline`, and realworld's suite went from about 2s to about 60s of imports, with two timeouts.

Contract notes for the later tasks:
- The ambient `declare module 'virtual:sleek/server-app'` (default export `DiscoveredApp`) ships from start in `src/server-app.ts`. A side-effect import in `index.ts` pulls it in. The generated declaration in tasks 7 and 8 must not redeclare `default`. It can add named exports, for example entries typed by route name.
- The entry values are eager, not lazy imports as task 8's text says. `ControllerEntry` is `{ route, pattern, methods: { [Method]?: { run, params?, query?, body?, success? } }, options: ControllerOptions[] }`. The `options` chain runs outermost first, and each element carries its `file` for app-load errors.
- `serverServices()` does not write `virtual:sleek/server-app` into the server declaration and does not invalidate it in dev. Task 7 owns both.
- "No explicit options" means `Object.keys(options).length === 0`, so `start({})` counts as none.
- `configureRuntime` still runs when `start()` is called. Discovered Layers (sibling spec) will need it moved to the first request.
- Follow-up, not built: start's dist is bundler-only (extensionless imports). Publishing it would need NodeNext imports.

Gates: the baseline was green. `pnpm turbo run test typecheck` for the spec's filters, plus showcase and docs (api-coverage included), is green. `pnpm --filter realworld check` is green. The fixture graph check diff is empty.
GATE_SKIPPED:unittest:green-receipt 1fa0aad3 - baseline reused from prior post-gate pass

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - ran (codex: fan-out NEEDS_WORK, 2 findings; fixed one, the other withdrawn; re-review SHIP)
## Evidence
- Commits: 2bae4b0e50d7c461d96759be48392722de0cceb3, 1fa0aad352cf37554fc6e283f2aa8d182a03bfbc
- Tests: GATE_SKIPPED:unittest:green-receipt 1fa0aad3 - baseline reused from prior post-gate pass, pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm turbo run test typecheck --filter=showcase --filter=docs, pnpm --filter realworld check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts) # diff vs pre-change: empty
- PRs: