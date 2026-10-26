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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
