# fn-68-file-routed-controllers.12 docs, ADR status, README and llms.md finalization for Controllers

Touches: [apps/docs/content/docs/**, apps/docs/snippets/**, apps/docs/test/**, packages/start/README.md, packages/ui-vite/README.md, packages/analyze/README.md, README.md, docs/adr/**, docs/proposals/start-framework.md, CONTEXT.md, packages/cli/llms.md]

## Description
Finish the documentation and status work of ADR 0053 once the code exists.

**Size:** M
**Files:** `apps/docs/content/docs/server-services.mdx`, `vite.mdx`, `errors.mdx`, `testing.mdx`, `index.mdx`, `meta.json` and a new Controllers guide with type-checked snippets, `packages/start/README.md`, `packages/ui-vite/README.md`, `packages/analyze/README.md`, `README.md`, `docs/adr/README.md`, `docs/adr/0053-file-routed-controllers.md`, `docs/proposals/start-framework.md`, `packages/cli/llms.md`

### Approach
- Docs pages: `server-services.mdx:21,27,37-42,60,62-66` (the request-services list gains `ResponseStatus`, the generated modules gain `virtual:sleek/server-app`, the boundary list gains Controllers, testing gains `callController`); `vite.mdx:8-17,27-31,41-56` (options `serverDir`, `controllersDir`); `errors.mdx`, `testing.mdx:9`, `index.mdx:18`. A new guide must be listed in `meta.json`, use `<include>` of type-checked `apps/docs/snippets/**` (no inline fences), and any snippet using a virtual module needs a committed declaration beside it, except for the default export of `virtual:sleek/server-app`, which `@sleekstack/start` declares itself. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 shipped that declaration from start -->
- Wording that fn-68.2 left stale: the server-only list is `*.server.ts`, `*.controller.ts` and `_defaults.ts` under the server directory (`SERVER_ONLY` and `isServerOnly` of `@sleekstack/analyze`), yet `server-services.mdx:60` and the `ServerFileInClientGraph` row of `errors.mdx` name only `*.server.ts`. A test file is now one under `__tests__/`, `test/` or `tests/` or named `*.test.*` or `*.spec.*` (`TEST_FILE`), so check "outside test files" in `testing.mdx:15` and `packages/analyze/README.md:12`. `serverDir` is a Vite-only option: `sleekstack check` cannot see it, always reads the default `server` directory, and has no CLI flag; say so in `vite.mdx`. <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 widened the server-only list and the test-file predicate, and left the Vite-only `serverDir` note to this task -->
- Public exports need TSDoc (`api-coverage.test.ts`); `generate:api` output is never hand-edited.
- ADR 0053: status `Accepted`, `Built in spec fn-68`; README row updated; leave ADR 0054 as Proposed (the sibling spec flips it). Add a pointer in `docs/proposals/start-framework.md` §6-7 to ADR 0053.
- Run the docs tests and build with `--concurrency=1` (they race on `api/.tmp`).

### Investigation targets
**Required** (read before coding):
- `apps/docs/content/docs/server-services.mdx`, `vite.mdx`
- `apps/docs/test/examples.test.ts`, `guides.test.ts`, `api-coverage.test.ts`
- `apps/docs/snippets/server-services/server.gen.d.ts` - declaration precedent

**Optional**:
- `docs/proposals/start-framework.md:60-125`

## Acceptance
- [ ] the docs pages and guide describe Controllers, `ResponseStatus`, Directory Defaults and `callController`, with type-checked snippets
- [ ] ADR 0053 is Accepted with its spec id and the README row matches
- [ ] `cli/llms.md` is under its cap
- [ ] `pnpm turbo run test typecheck build --filter=docs --concurrency=1` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
