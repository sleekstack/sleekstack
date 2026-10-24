---
satisfies: [R11]
---
# fn-69-server-auto-wiring.8 showcase: Tally as a Controller and the RPC Manifest

Touches: [apps/showcase/server/**, apps/showcase/src/pages/tally.ts, apps/showcase/src/pages/server.tsx, apps/showcase/test/**, apps/showcase/vite.config.ts, apps/showcase/README.md, apps/showcase/src/server.gen.d.ts]

## Description
Prove the Manifest on a real consumer: showcase's `Tally` becomes a Controller plus a Manifest entry (R11).

**Size:** M
**Files:** `apps/showcase/server/routes/api/tally.controller.ts` (new), `apps/showcase/server/rpc.ts` (new), `apps/showcase/server/tally.layer.ts` (new, holds the tally `Ref`), `apps/showcase/server/routes/api/_defaults.ts` (new), `apps/showcase/server/app.ts`, `apps/showcase/server/tally.server.ts` (deleted), `apps/showcase/server/dev.ts`, `apps/showcase/src/pages/tally.ts`, `apps/showcase/src/pages/server.tsx`, `apps/showcase/test/server.test.ts`, `apps/showcase/test/size.test.ts`, `apps/showcase/test/architecture.test.ts`

### Approach
- Controller `GET`/`POST /api/tally` answers bare numbers; `read` and `add` become the Manifest's `Tally.read` and `Tally.add`; the wire ids stay. Keep `TallyLimit` client-safe in `src/pages/tally.ts` and delete the `Tally` contract there.
- The tally state lives in a Layer File so both faces share it; a showcase `_defaults.ts` `wrap` maps `TallyLimit` to 409 with `{ limit }` for REST.
- Page: `tally.add({ by: 1 })` becomes `tally.add({ body: { by: 1 } })` (`server.tsx:56`), importing the Tag from `virtual:sleek/rpc`. Keep `client(addItem)` and the `serverFn` untouched (`server.tsx:8-9`).
- Dev server forwards Controller paths through the plugin predicate (`server/dev.ts:12` forwards only `/_sleek/` today); update `server.test.ts` (`:75-77` bodies become `{ body: { by } }`, `:95`, `:102-121`), the client-chunk test (`size.test.ts:30-48,107-125`: `serverServices()` plugin list, markers, no `server/` module in the client) and the architecture test for `virtual:sleek/rpc`. <!-- Updated by plan-sync: fn-68-file-routed-controllers.8: `devMiddleware(load, accepts)` is a public export of `@sleekstack/ui-vite` (`accepts(pathname)` may return a promise) and `isControllerPath(pathname)` is a named export of `virtual:sleek/server-app`, so showcase's own `server/dev.ts` can give way to `devMiddleware(async () => (await server.ssrLoadModule('/server/app.ts')).app, async (pathname) => pathname.startsWith('/_sleek/') || (await server.ssrLoadModule('virtual:sleek/server-app')).isControllerPath(pathname))` in `vite.config.ts` (realworld keeps its own only because it injects the page into `index.html`). `server.test.ts` calls `devMiddleware(async () => app)` from `../server/dev`; under Vitest the plugin is in the config, so a test may pass `(await import('virtual:sleek/server-app')).isControllerPath`, as realworld's `server.test.ts` does. The server measure of `size.test.ts` asserts `server.modules.some((id) => id.endsWith('/server/tally.server.ts'))`, and that file is deleted: assert the Controller or Layer File module instead. The `pages/` rule of `architecture.test.ts` (`:55-66`) has no `virtual:sleek/rpc` -->
- Touches note: `apps/showcase/src/server.gen.d.ts` is outside Touches, which names only `src/pages/**` under `src/`. It is the committed declaration the plugin rewrites (it gains the `virtual:sleek/server-app` section and the generated Tag), so commit it as written and never hand-edit it. <!-- Added by plan-sync: fn-68-file-routed-controllers.7 -->
- Types: showcase's `layer` provides `Tally` through `TallyLive` today, and `ServerFnDemo` needs `Tally`. Once `TallyLive` is gone `Tally` comes from the generated implementation Layer, which typechecks only with task 3's relaxation of `start`'s stage requirements. <!-- Updated by plan-sync: fn-69-server-auto-wiring.3 shipped it: `StartOptions` excludes the Tags in the generated `GeneratedServices` and `LayerFileServices` from `Needs`, so the generated declaration (task 4 and 5) must fill them for `Tally` --> <!-- Updated by plan-sync: fn-69-server-auto-wiring.6 fills `LayerFileServices` in the generated declaration, keyed by Layer File (not by Tag) as `Layer.Layer.Success<typeof import(file).default>`, so `tally.layer.ts` must default-export its Layer; `start` reads only the union of the values -->. <!-- Added by plan-sync: fn-68-file-routed-controllers.1 -->


<!-- Added by plan-sync: fn-69-server-auto-wiring.10: realworld's `start` dropped `layer` because `start`'s option type (`packages/start/src/start.ts:29-32`, outside this task's Touches and every remaining task's) rejects `Layer.empty` with TS2322. Showcase is not affected: `ItemsLive` stays, so its `layer` is `Layer.mergeAll(AppLive, ItemsLive)` once `TallyLive` goes, which is not `Layer.empty`. Do not pass `Layer.empty` or an `AppLive` that is empty; if the layer ever becomes empty, omit the option as `apps/realworld/server/app.ts` does -->

### Investigation targets
**Required** (read before coding):
- `apps/showcase/server/app.ts:1-32`, `tally.server.ts:7-16`, `src/pages/tally.ts:5-17`, `src/pages/server.tsx:53-81`
- `apps/showcase/test/server.test.ts:70-125`, `test/size.test.ts:30-125`

**Optional**:
- `apps/showcase/test/architecture.test.ts:55-66`

## Acceptance
- [ ] `GET` and `POST /api/tally` answer bare numbers; a past-limit `by` answers 409 `{ limit }`
- [ ] the page, the wire id `Tally.add` and the typed `TallyLimit` behave as before with the nested input
- [ ] the client-chunk bundle test passes and covers the generated modules; no `server/` module reaches the client
- [ ] `pnpm turbo run test typecheck --filter=showcase` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
