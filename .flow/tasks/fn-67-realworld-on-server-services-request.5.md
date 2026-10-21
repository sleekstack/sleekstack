---
satisfies: [R3, R4, R5, R6]
---
# fn-67-realworld-on-server-services-request.5 realworld: comments Server Service, remove the contract machinery, docs

## Description
The last Tag and the cleanup. `CommentsApi` (list, add, delete) replaces its 3 contracts; then everything the contracts needed goes: `viewerFn`, the id map, the `ServerFunctions` Tag with both Layers, the `functions` list, the contracts files and their re-exports. Finalization (docs guide section, start README, CONTEXT, ADR index) is part of this task, not a separate one.

**Size:** M
**Files:** apps/realworld/src/modules/comments/application/contracts.ts (replaced by the Tag), apps/realworld/src/modules/comments/index.ts, apps/realworld/server/comments-api.server.ts (new), apps/realworld/server/app.ts, apps/realworld/src/pages/functions.ts (deleted), apps/realworld/src/app.tsx, apps/realworld/src/main.tsx, apps/realworld/src/pages/loaders.ts, apps/realworld/src/routes/article/[slug].tsx, apps/realworld/test/*.test.ts, apps/realworld/README.md, apps/docs/content/docs/server-services.mdx, packages/start/README.md
**Touches:** [apps/realworld/**, apps/docs/content/docs/server-services.mdx, packages/start/README.md]

### Approach
- Comments: same shape as tasks 3 and 4. Then delete what nothing references: the `ServerFunctions` Tag, `ServerFunctionsClient`, `ServerFunctionsInPlace`, `viewerFn`, `byId`, the `functions` array, and `src/pages/functions.ts` (check `rg ServerFunctions` and `rg Contract` for stragglers in `src`, `server`, `test`).
- `app.ts` keeps only `services`, handlers and layers; if no `serverFn` remains in realworld, drop the unused imports.
- Docs: extend the Server Services guide with request services (`implement`, what it may require, per-call provision, cookies from an in-process loader call), note the realworld app as the worked example, add the exports to `packages/start/README.md` (do not hand-edit generated API pages; run `generate:api`), and update realworld's README where it describes the server functions.
- Run the AGENTS.md fixture graph check before and after.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/src/pages/functions.ts` — what is deleted
- `apps/realworld/server/app.ts` — the file after tasks 3 and 4
- `apps/realworld/src/modules/comments/application/contracts.ts`
- `apps/realworld/README.md` — the server-function description to rewrite
- `apps/docs/content/docs/server-services.mdx` and `apps/docs/test/examples.test.ts` — the guide and how its snippets are checked
- `packages/start/README.md` — the exports table

**Optional** (reference as needed):
- `apps/realworld/test/server.test.ts` — the wire-level tests

## Acceptance
- [ ] `rg 'ServerFunctions|viewerFn|Contract\b'` over `apps/realworld/{src,server,test}` finds nothing; no `serverFn(` remains there either.
- [ ] `CommentsApi` exists as one Tag with 3 methods and the comments pages call `yield* CommentsApi`.
- [ ] The whole realworld test suite passes unchanged apart from layer construction; `pnpm --filter realworld check` passes; the client bundle holds no `*.server.ts`.
- [ ] The docs guide covers request services with a type-checked snippet; `packages/start/README.md` lists `implement`; `generate:api` was run; CONTEXT.md and the ADR index are current.
- [ ] Fixture graph check output is identical before and after.
- [ ] `pnpm turbo run test typecheck --filter=realworld`, `pnpm turbo run test typecheck build --filter=docs --concurrency=1` and `pnpm turbo run test typecheck --filter=@sleekstack/start...` pass.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
