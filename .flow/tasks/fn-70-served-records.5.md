---
satisfies: [R5, R7, R8]
---
# fn-70-served-records.5 analyze: recognize records(...) default export, RecordsRouteShape and RecordsMethodCollision

Touches: [packages/analyze/src/**, packages/cli/src/**, apps/docs/content/docs/errors.mdx]

## Description
Teach the Controller pass to read `export default records(X)`: the synthesized `GET` and `PATCH`, the record and its adapter Tag, and the two diagnostics. This is the early proof point of the spec.

**Size:** M
**Files:** `packages/analyze/src/controllers.ts`, `packages/analyze/src/errorCodes.ts`, `packages/analyze/src/model.ts` (AnalyzeCode union), `packages/analyze/src/index.ts`, `packages/analyze/src/__tests__/controllers.test.ts` and a new fixture `records-controller/`, `packages/cli/src/__tests__/check.test.ts`, `apps/docs/content/docs/errors.mdx` (rows under controller errors)

### Approach
- Since fn-71 (ADR 0056): `ControllerDecl.kind` (`packages/analyze/src/controllers.ts:144`) is `'functions' | 'class'`; add `'records'`. A default export that is a `records(...)` call is the records form (named exports beside it allowed); a default class beside it, or a default export that is neither a class nor a `records` call, keeps today's `ControllerMethodShape`/ignore behavior. Read the class reader (ADR 0056) first so the two default-export readers share one resolution.
- Resolve the default export's call by declaration, as `ServerService`'s base call resolves in `packages/analyze/src/serverServices.ts` (imports through re-exports and barrels work); the callee must be `records` of `@sleekstack/start`, the argument must reach a `defineRecord` call whose options carry `adapter`. A spike inside this task: if resolution through a barrel fails, fix it here; if it cannot be made to work, stop and report (the spec's early proof point).
- `ControllerDecl` (`controllers.ts:92`) gains the record and the Tag; the served methods appear as `GET` and `PATCH` with `params` `{ id }`. Report the adapter Tag as a requirement of the Controller so Layer File composition (fn-69) flags `MissingDependency`.
- `RecordsRouteShape` covers the four causes in R5; `RecordsMethodCollision` a named `GET`/`PATCH` beside the default export. Each gets its `ERROR_CODES` row (rule, fix, docs) in `errorCodes.ts:30-60` pattern and its section in `errors.mdx`.
- Pin R8 with a check test: a client-safe record module that imports a `*.layer.ts` is `ServerFileInClientGraph`.

### Investigation targets
**Required**:
- `packages/analyze/src/controllers.ts` - route derivation, method reading, `analyzeControllers`
- `packages/analyze/src/serverServices.ts` - base-call resolution and `SERVER_ONLY`
- `packages/analyze/src/errorCodes.ts` - the table and its row shape
- `packages/analyze/src/__tests__/` fixtures for controllers - fixture layout
- `docs/adr/0054-server-auto-wiring.md:16` - Layer File requirement composition

### Acceptance
- [ ] A fixture with `export default records(Article)` yields `GET` and `PATCH`, the record, the adapter Tag, through a re-export barrel as well
- [ ] Each `RecordsRouteShape` cause (wrong path, not a `records` call, unresolvable or adapter-less record, record needing a Service) and `RecordsMethodCollision` has a named test; a named `DELETE` beside the default export is not an error
- [ ] With no Layer File providing the Tag, `sleekstack check` reports `MissingDependency`; with one, clean; with two, `LayerFileConflict`
- [ ] Each new code has its table row; `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes; fixture graph check output unchanged

## Acceptance
- [ ] TBD

## Done summary
The Controller pass now reads `export default records(X)` (packages/analyze/src/controllers.ts, `recordsOf`). Such a Controller has `kind: 'records'`, the served `GET` and `PATCH` with params `{ id }`, and `record: ServedRecord` (const name, file, adapter Tag type, location). The callee and the record are resolved by declaration through re-export barrels: `libId` now recognizes `@sleekstack/model`, so `defineRecord` resolves as `model/record#defineRecord`. The early proof point holds: the barrel fixture `barrel/[id]` resolves both `records` and `Article` through `barrel.ts`.

The adapter Tag is the Controller's one requirement and is reported once as `MissingDependency` at the default export. `RecordsRouteShape` covers each R5 cause, and a `records` that is not the one from @sleekstack/start is also `RecordsRouteShape`. `RecordsMethodCollision` covers a named GET or PATCH beside the default export. A named DELETE is an ordinary method, and a default export that calls something not named `records` stays `ControllerMethodShape`. Each code has its ERROR_CODES row, an errors.mdx row and an llms.md line.

Tests: packages/analyze/src/__tests__/controllers.test.ts, `analyzeControllers: records(...)`, over the fixture records-controller/. It has one named test per RecordsRouteShape cause, one for the collision, one for DELETE, and one each for the direct and barrel resolution. All of them failed against the pre-change pass. packages/cli/src/__tests__/check.test.ts uses fixtures/records/{missing,clean,conflict,boundary} to pin R7 (MissingDependency, clean, LayerFileConflict) and R8 (ServerFileInClientGraph).

Deviations: packages/cli/llms.md is outside Touches. I regenerated it with `UPDATE_LLMS=1`, as its llms test requires for every new ERROR_CODES row. extract.ts (inside packages/analyze/src/**) gained `model` in libId's package list.

Surprise for task 6: `packages/ui-vite` typecheck now fails. `ControllerRead.kind` in packages/ui-vite/src/server-services.ts:442 is `'functions' | 'class'`, and `kind: c.kind` at :457 now receives `'records'`. Widen it to `ControllerDecl['kind']` when task 6 generates the records entry. Until then, a records Controller's GET and PATCH would also be emitted as `<module>.GET`, which does not exist. The served methods carry `schema.input` params only and `success: undefined`, and the body and answer are the record's (`record.change`, its wire form), which task 6 reaches through `record.file` and `record.name`.

Fixture graph check output is unchanged.

Tier: implementer (actual_model: claude-opus-5-5)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 6cc49ce59e016b1f7332a3768b14d06789125bf0
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack, fixture graph check: unchanged
- PRs: