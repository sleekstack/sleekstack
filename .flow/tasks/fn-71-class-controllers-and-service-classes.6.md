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
- <!-- Updated by conductor: fn-71.4 shipped. Document the new public type `ControllerMethodsOf` (TSDoc is in `@sleekstack/start`), the Service-key reload rule (a file may re-define its key; a different file reusing a key throws; two Services with one key in one file are not caught), the analyzer report fields `ControllerDecl.kind`/`declared` and `RpcMethod.controller.kind`, and the class module's generated declaration shape. The ui-vite tests import start's built `dist`, so start must be rebuilt before running them alone. -->
- <!-- Updated by conductor: fn-71.5 shipped. Realworld now shows both forms in one app: the article Controllers are class Controllers declaring `Articles`, and the user and profile Controllers stay named-export Controller Methods; a class file's `ControllerModules` entry is `ControllerMethodsOf<typeof default>`. The comment Controllers declare `Articles` but reach it through `listComments`/`addComment`/`deleteComment` (their tests call those functions), so the guides should say that declaring a dependency a method does not read is only documentation, or show passing `this.<name>` along. In the class form each method lost its `Effect.gen` wrapper and `const articles = yield* Articles` line, and `Articles` left its written `R`; the TSDoc sits on methods; `export default class extends` is unnamed, so spans read `Controller.<method>`. The README sentence about the class Controllers is already in `apps/realworld/README.md` (fn-71.5). -->

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
ADR 0056 is Accepted ("Built in spec fn-71") with each line checked against the build (Gen read by imported symbol, static `run`, per-instance Service and per-class Controller wrapping, ControllerMethodsOf, the Service-key reload rule, `kind` in the report; the Settled section dropped); ADR 0053's class-controller rejection points to it and the index has the 0056 row (no 0055 row). CONTEXT.md has Service Class, Class Controller and Declared Dependency; the Controllers guide has a Class Controllers section (snippet `server/routes/notes/[id]/title.controller.ts`, declared in the snippet `server.gen.d.ts` as `ControllerMethodsOf`) and the Server Services guide shows `Effect.Service` and the Service Class side by side (`greeter-effect.ts`, `greeter-class.ts`); errors.mdx, the start/analyze/ui-vite READMEs and llms.md (7485 bytes) describe the class form.

- llms.md's error section is generated from `ERROR_CODES`, so the `ControllerMethodShape` rule (and one fix line) changed in `packages/analyze/src/errorCodes.ts`, outside the task's Touches list; llms.md has one added vocabulary line.
- realworld README already carried the class Controller sentence (fn-71.5); unchanged.
- fn-70 also edits CONTEXT.md, errors.mdx, llms.md and the ADR index: whichever lands second rebases and re-checks llms.md's size.

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
Tier: implementer opus at medium
## Evidence
- Commits: 6217c0d904c3e33b2a7453e85befa9769c71a36a, 65491fadd24a5accab95b8cfc57f3b9c28829656, 0223933714339a43a75caae06adb58e3d63a7abd, b6b4492a98103bfe8beefd75bb60c7c2d8e3f1d6, 63eefa16015d0de1c1d119ddfd5a911e70785fa1
- Tests: pnpm turbo run test typecheck build --filter=docs --concurrency=1, pnpm --filter realworld check, pnpm --filter showcase check, pnpm format:check, cd packages/cli && npx vitest run llms, cd packages/analyze && npx vitest run errorCodes, pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --concurrency=1
- PRs: