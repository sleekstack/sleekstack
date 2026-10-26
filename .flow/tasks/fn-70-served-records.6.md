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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
