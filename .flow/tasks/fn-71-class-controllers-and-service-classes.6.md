---
satisfies: [R8]
---
# fn-71-class-controllers-and-service-classes.6 docs and finalization: ADR 0056 accepted, CONTEXT.md, guides, READMEs, llms.md

Touches: [docs/adr/**, CONTEXT.md, apps/docs/content/docs/**, apps/docs/snippets/**, packages/start/README.md, packages/analyze/README.md, packages/ui-vite/README.md, apps/realworld/README.md, packages/cli/llms.md]

## Description
Finish the documentation and status of ADR 0056 once the code exists. Land after fn-70-served-records tasks 1 and 8 (shared ADR index, `CONTEXT.md`, `errors.mdx`, `llms.md`, READMEs); if they landed first, rebase and re-check the `llms.md` size.

**Size:** M
**Files:** `docs/adr/0056-class-controllers-and-service-classes.md`, `docs/adr/README.md`, `docs/adr/0053-file-routed-controllers.md`, `CONTEXT.md`, `apps/docs/content/docs/controllers.mdx`, `server-services.mdx`, `errors.mdx`, snippets under `apps/docs/snippets/controllers/` and `server-services/`, the READMEs of start, analyze, ui-vite and realworld, `packages/cli/llms.md`
**Touches:** [docs/adr/**, CONTEXT.md, apps/docs/content/docs/**, apps/docs/snippets/**, packages/start/README.md, packages/analyze/README.md, packages/ui-vite/README.md, apps/realworld/README.md, packages/cli/llms.md]

### Approach
- ADR 0056: Proposed to Accepted, add a "Built in spec fn-71" line, and correct any line the build made stale (the `Gen` reading decision of task 2, the per-class wrapping). ADR 0053: its "Decorators and class controllers" rejection gets a pointer to ADR 0056 for the class form only. `docs/adr/README.md` indexes up to 0054, so add the 0056 row and check for the 0055 row of fn-70.
- `CONTEXT.md` (Controller at 196, Controller Method at 200): add Service Class, Class Controller and Declared Dependency, with `_Avoid_` lines.
- Guides show `Effect.Service` and the class form side by side with type-checked snippets (`examples.test.ts` typechecks them in place; a snippet that uses a virtual module needs a committed declaration beside it, declared once in the shared TS program; every snippet file must be included by a guide).
- `errors.mdx` rows for `ControllerMethodShape` (class shapes) and `MissingDependency` (declared Tags); `llms.md` is 7082 of 8192 bytes, so keep the additions short and re-check the size.
- READMEs: start export table (`Service`, `Controller`, `Gen`, `accessors`), analyzer Controller pass bullets, realworld "Two server surfaces".

### Investigation targets
**Required**:
- `docs/adr/0056-class-controllers-and-service-classes.md`, `docs/adr/0053-file-routed-controllers.md`, `docs/adr/README.md`
- `apps/docs/content/docs/controllers.mdx`, `apps/docs/test/guides.test.ts`
- `packages/cli/llms.md` (lines 85-91 hold the Controller rows)

### Acceptance
- [ ] ADR 0056 is Accepted and no line of it is stale against the build
- [ ] `CONTEXT.md` names the three terms and uses no `_Avoid_` name
- [ ] both guides show the class form beside the function form with snippets that typecheck; `llms.md` is under 8192 bytes
- [ ] `pnpm turbo run test typecheck build --filter=docs` and `pnpm format:check` pass

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
