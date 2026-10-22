---
satisfies: [R12]
---
# fn-68-file-routed-controllers.2 analyze+ui-vite: one server-only list shared by check and the plugin

Touches: [packages/analyze/src/serverServices.ts, packages/analyze/src/extract.ts, packages/analyze/src/index.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/__tests__/**, packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/server-services.test.ts]

## Description
Replace the two private copies of the server-only rule with one analyzer export (R12), and add the new Controller kinds to it. Refactor-shaped: `*.server.ts` behaviour must not change.

**Size:** S
**Files:** `packages/analyze/src/serverServices.ts`, `packages/analyze/src/extract.ts`, `packages/analyze/src/index.ts`, `packages/analyze/src/errorCodes.ts`, `packages/ui-vite/src/server-services.ts`, their tests

### Approach
- Export one list as data: kind patterns (`*.server.ts`, `*.controller.ts`) plus reserved names scoped to the server directory (`_defaults.ts` now; the sibling spec adds `rpc.ts`, `_app.ts`), and one broadened test-file predicate (`__tests__/`, `test/`, `tests/`, `*.test.*`, `*.spec.*`). Today these are `SERVER_FILE` at `analyze/serverServices.ts:22` and `ui-vite/server-services.ts:28`, and `TEST_FILE` at `analyze/extract.ts:63` and `ui-vite/server-services.ts:30`.
- Have the plugin read the list through its existing jiti route to the analyzer (`server-services.ts:153-168`), and delete its copies. The load guard (`:260-277`) uses the list; the watch predicate stays separate (it watches contract sources, not server-only files). <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 added lines to server-services.ts, so the line references moved -->
- Add the `serverDir` plugin option (default `server`) used to scope the reserved names.
- Update the `ServerFileInClientGraph` rule text (`errorCodes.ts:166`).
- Equivalence pin: the existing boundary tests in analyze and ui-vite, the `server-boundary` check fixture, and the showcase and realworld client-chunk tests pass unchanged.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:21-22,277-337` - list, valueImports, graph walk
- `packages/ui-vite/src/server-services.ts:28-30,153-168,260-277` - copies, jiti route, load guard
- `packages/analyze/src/errorCodes.ts:160-170`

**Optional**:
- `packages/cli/src/__tests__/check.test.ts` - boundary fixtures

## Acceptance
- [ ] one exported list; no private `SERVER_FILE` or `TEST_FILE` left in ui-vite
- [ ] a `*.controller.ts` reachable from a browser entry fails the client build and is reported as `ServerFileInClientGraph`
- [ ] a `_defaults.ts` outside the server directory is not flagged
- [ ] a test-only file under `test/` is excluded like one under `__tests__/`
- [ ] existing boundary tests pass unchanged
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
