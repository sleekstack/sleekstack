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
Realworld's comments are now the `CommentsApi` Server Service. The Tag is in `src/modules/comments/application/contracts.ts`, with 3 methods: list, add and delete. `server/comments-api.server.ts` builds `CommentsApiLive` with `implement`, following the pattern of tasks .3 and .4. The comment domain functions fail only with errors their contracts declare, so no defect conversion was needed (unlike `createArticle`). The contract machinery is gone: the `ServerFunctions` Tag, `ServerFunctionsClient`, `ServerFunctionsInPlace`, `viewerFn`, `byId`, the `functions` list and `src/pages/functions.ts`. `server/app.ts` now holds only `services`, the middleware and the layers. The loaders and `article/[slug].tsx` call `yield* CommentsApi`. The tests changed only in the wire ids (`CommentsApi.*`) and their layers, which are now `QueriesLive` plus the generated browser Layer. `architecture.test.ts` no longer lets `pages/` or `routes/` import `@sleekstack/start/client`, and `app` may import nothing local.

Docs: the Server Services guide has a "Request services" section with a type-checked snippet (`snippets/server-services/profiles-session.server.ts`). It names realworld as the worked example and no longer lists request services as a limitation. The contract rules now name `Schema.TaggedError` and string-keyed records. `packages/start/README.md` lists `implement` and ADR 0052. The realworld README describes the Server Services. `generate:api` was run; its output is gitignored. CONTEXT.md and the ADR index were already current. Under the conductor's allowance, the rule text of `ServerServiceFileShape`, `ServerServiceMethodShape` and `ServerServiceTypeNotSerializable` in `errorCodes.ts` names `Schema.TaggedError` and records. `llms.md` was regenerated (7433 bytes), and `errors.mdx` was updated to match. Stale "server function" prose in `server/dev.ts`, `server/rest.ts` and the test headers now says Server Service.

Gates, re-run after the host slept (forced, uncached):
- Realworld test and typecheck: green, 155 tests. `pnpm --filter realworld check`: green.
- `@sleekstack/start...`, analyze and sleekstack: green. The first forced run hit load timeouts (load average 19). The serial forced rerun of ui, analyze and cli tests was green.
- Docs typecheck and build: green. The guide snippets compile.
- Fixture graph: identical to /tmp/fixture-before-fn67-t5.json. The AC grep finds nothing. Prettier is clean on every touched TS file.

Docs test: INHERITED RED, not caused by this task. Two tests fail in `packages/start/src`, which is outside this task's Touches. A worktree at base d9828d23 reproduces both.
1. `api-coverage`: `StartOptions` has no summary. d9828d23 put `type TagsOf` between the TSDoc of `StartOptions` and its declaration in `start.ts`. Fix: move that comment back onto `StartOptions`.
2. `examples`: the `@example` of `implement` in `implement.ts` (from dc3e24a6) imports a nonexistent `./session`. Fix: declare the `Session` contract inline in the example.

baseline: green (pnpm turbo run test typecheck --filter=realworld && pnpm --filter realworld check, pre-edit); docs test red pre-edit (see above)

Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 390b754b5004fb6cf311cc1ba93811dcebf598de
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check, pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/analyze --filter=sleekstack, pnpm turbo run test typecheck build --filter=docs --concurrency=1 (test: 2 inherited failures in packages/start/src, red at base d9828d23), fixture graph check: identical to /tmp/fixture-before-fn67-t5.json
- PRs: