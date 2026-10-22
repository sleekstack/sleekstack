---
satisfies: [R8, R10, R12]
---
# fn-68-file-routed-controllers.8 ui-vite: server-app codegen for Controllers and dev forwarding

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/dev.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/**, packages/ui-vite/README.md]

## Description
Emit the discovered-app module that `start()` reads, from the discovery of task 7 and the reader of tasks 3 and 4, and give dev servers what they need to forward Controller paths (R8, R10, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/dev.ts`, `packages/ui-vite/src/index.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, `packages/ui-vite/README.md`

### Approach
- Emit one entry per Controller in the contract of task 1: route name and pattern, per-method input Schemas (params, query, body; string codecs on the HTTP face) and success Schema printed through the extended `printSchema`/`entriesCode` (`server-services.ts:80-134`), and the option chain as eager imports of the Controller and `_defaults.ts` modules: each method's `run` and each option element's `wrap`, `bodyLimit`, `origins` and `file` are plain values (`ControllerEntry`, `ControllerOptions` of `packages/start/src/app.ts`). Eager is safe because `start` imports the module only on the first request, so a Controller may import `start`. The plugin serves `export default { controllers: [] }` today (`server-services.ts:283`); this task replaces it. Generated keys are computed properties; read nothing from a virtual module at top level. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 defined the entry values as eager, not lazy imports --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 moved the server-services.ts references --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 moved them again -->
- `printSchema` already prints what the entries need and this task adds no printing for it: a `ref` (`{ kind: 'ref', file, name }`) through `alias(file, name)`, and `codec: 'string'` on a `number` or `boolean` as the finite-decimal transform and `Schema.BooleanFromString`. `alias` is built inside `entriesCode` (`server-services.ts:113-119`), so the Controller entries must share its import map rather than make a second one; `ref.file` is relative to the tsconfig directory, as the contract files are. The reader marks nothing `codec: 'string'` itself: task 4 marks the `params` and `query` leaves, and this task only splits `schema.input` (an `object` of `params`, `query`, `body`; `void` for a method with no parameter; a whole-input `ref` is refused by task 4) into the three Schemas. <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 added the `ref` kind and string codecs to the reader and `printSchema` --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 shipped the marking and the whole-input refusal. A `ControllerMethod.schema` of `analyzeControllers` is `{ input, success }`: `input` is `{ kind: 'void' }` or `{ kind: 'object', properties }` whose `PropertySchema` entries (`{ name, optional, type }`) are only `params`, `query` and `body` (an optional key has `optional: true` and a union with an `undefined` member); the `number` and `boolean` leaves of `params` and `query`, including query array elements, carry `codec: 'string'`, and a referenced Schema there stays a `ref`. `success` is undefined when the return type is not written, so that entry has no encode Schema (R5: serialize as is). `ControllerDecl.methods` holds only the methods read without error, in the order GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS -->
- When file routes exist (`virtual:sleekstack/routes`) and the app gives no `router`, the default export also carries the page router (`DiscoveredApp.router`) built from them (`router({ table, pages, notFound })`, as realworld's `src/app.tsx:8` does by hand).
- Declaration: name each Controller module by import type so the analyzer reads it through the declaration (memory `analyzer-reads-every-file-route-through`). `@sleekstack/start` already declares the module's default export (`DiscoveredApp`, `packages/start/src/server-app.ts`): do not redeclare `default`; added exports are named. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 shipped the ambient declaration -->
- Dev forwarding: export `devMiddleware` (`dev.ts:11-29`) and a predicate the discovered app provides, so an app's dev server no longer hard-codes `/api/`.
- The client environment never loads a Controller: the load guard from task 2 fails the build with the chain (R12). Its `load` filter now matches every source and asks the analyzer's `isServerOnly(id, serverDir)`, so the `SERVER_APP` branch sits beside it in the same handler. <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 moved the guard onto the analyzer's list -->

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:80-154,279-325`
- `packages/ui-vite/src/dev.ts:11-29`
- `apps/realworld/src/app.tsx:8` and `apps/realworld/server/dev.ts:13-16`
- `.flow/memory/bug/integration/analyzer-reads-every-file-route-through-2026-10-20.md`

**Optional**:
- `packages/ui-vite/src/__tests__/plugin.test.ts` - an http dev entry

## Acceptance
- [ ] a generated entry round-trips through `start` in a test: a Controller with a referenced Schema, a printed type with string codecs, and an option chain
- [ ] the discovered app carries `router` only when file routes exist and `router` is not given
- [ ] the dev forwarding predicate matches Controller paths and not asset or module requests
- [ ] `vite build --ssr` resolves the module and the client build excludes every Controller
- [ ] the generated declaration is committed in the fixtures and typechecks
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
