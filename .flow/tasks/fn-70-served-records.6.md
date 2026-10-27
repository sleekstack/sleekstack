---
satisfies: [R4, R6, R7]
---
# fn-70-served-records.6 ui-vite: codegen for served records and the generated browser Layer

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/dev.ts, packages/ui-vite/src/__tests__/**]

## Description
Emit, from the Analyzer's read, the Controller entry for a served record and the browser Layer that provides its adapter Tag. Depends on fn-69's generated-Layer machinery, so it lands after that spec.

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/index.ts`, `packages/ui-vite/src/dev.ts` (reload on the record module), `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture `records/`

### Approach
- Drift from task 5: `ControllerDecl.kind` is now `'functions' | 'class' | 'records'`, and `packages/ui-vite/src/server-services.ts` (`ControllerRead.kind`, about line 442) still allows only the first two, so the ui-vite typecheck is RED on entry: widen it to `ControllerDecl['kind']` first. The analyzer reports a records Controller's `GET`/`PATCH` with only the `params` Schema and gives the record by `record.file` and `record.name` (plus its adapter Tag); build the body and answer Schemas from the record at run time through `recordsMethods(...)`. Until this task, generated code for a records Controller would wrongly emit `<module>.GET`/`.PATCH`.
- `recordAdapterLayer` is exported from `@sleekstack/start/client` (the browser-safe entry): import it from there in the generated browser Layer, not from `@sleekstack/start`.
- In the discovered-app module (fn-68 task 8), a records Controller's `methods` come from `recordsMethods(...)` (start task 3) instead of from named exports; named exports beside it are emitted as ordinary methods.
- Add one `recordAdapterLayer(record, pattern)` (start task 4) per served record to the browser Layer exported by `virtual:sleek/server` (fn-69 task 4/6 own that composition); it is NOT part of the server composition (R7). The record and Tag are imported from their client-safe module only.
- Dev: editing the record module or the controller re-emits the declaration, as for a Controller (fn-68 task 7).
- Equivalence pin: a fixture app with a hand-written Controller and no records emits a byte-identical module before and after this task.

### Investigation targets
**Required**:
- `packages/ui-vite/src/server-services.ts` - entry codegen, `entriesCode`, the browser Layer generation
- `packages/ui-vite/src/__tests__/server-services.test.ts` - fixture and snapshot style
- `packages/start/src/records.ts`, `recordsClient.ts` (tasks 3 and 4) - what the generated code calls
- `docs/adr/0054-server-auto-wiring.md:15` - `virtual:sleek/server`, `virtual:sleek/server-app`

### Acceptance
- [ ] A served-record fixture serves GET and PATCH through the generated app, and the browser Layer provides the adapter Tag with the route's pattern
- [ ] Renaming the controller file changes the generated pattern and nothing else
- [ ] The generated server composition never contains the HTTP adapter Layer (no `LayerFileConflict`)
- [ ] A no-records fixture's generated output is unchanged
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Acceptance
- [ ] TBD

## Done summary
The ui-vite codegen now handles served records (packages/ui-vite/src/server-services.ts). In a records Controller's entry in `virtual:sleek/server-app`, `methods` is `{ ...recordsMethods(<module>.default), <named methods except GET/PATCH> }`. `virtual:sleek/server` default-exports `Layer.mergeAll(serverClients(entries), recordAdapterLayer(<Record>, "<pattern>"), ...)`. That code imports `recordAdapterLayer` from `@sleekstack/start/client` and the record from its own client-safe module. The declaration types the browser `layer` with each record's adapter Tag identifier. The registry and the server app never contain `recordAdapterLayer` (R7). In dev, editing a served record's module invalidates the discovered app the same way a Controller edit does. The first step was the task-5 drift fix: `ControllerRead.kind` is now `ControllerDecl['kind']`.

Tests are in packages/ui-vite/src/__tests__/server-services.test.ts, `describe('served records')`, over the new fixture fixtures/records/ (record + Tag in src/article.ts, `records(Article)` beside a named DELETE, and an in-memory Layer File).
- Test 1 (AC1/AC3) covers GET 200/404 and PATCH 200/422 through `start()`, and that DELETE stays an ordinary method. It also checks that the server app and registry hold no `recordAdapterLayer`, that the client Layer's `find` fetches `/articles/a%20b`, and that a consumer typechecks against the declaration.
- Test 2 (AC2): renaming the Controller file changes only the pattern in the client module.
- Test 3: a record-module edit reloads the app in dev.
Tests 1 and 3 were confirmed red against the pre-change codegen. Test 2 passed vacuously at first, so a precondition was added. AC4 (no-records output unchanged) is pinned by the existing inline snapshots of the client module and the controller-app server module, which pass unchanged.

Deviations:
- packages/ui-vite does not depend on `@sleekstack/model`. The test scaffold maps `@sleekstack/model` to the model source through tsconfig `paths` and a Vite alias, and it is a test-only change.
- dev.ts needed no change: the reload lives in server-services.ts's watcher.
- When discovery fails, the client module omits the record Layers rather than failing. The server-app load and the build already report that error.

Tier: implementer (actual_model: claude-opus-5-5)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: d2c7896f041a82f412cac518efb98b2772e195cd
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... (baseline: red - ui-vite typecheck TS2769 at server-services.ts:454, task-5 drift, fixed in this task), pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...
- PRs: