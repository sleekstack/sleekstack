# fn-68-file-routed-controllers.12 docs, ADR status, README and llms.md finalization for Controllers

Touches: [apps/docs/content/docs/**, apps/docs/snippets/**, apps/docs/test/**, packages/start/README.md, packages/ui-vite/README.md, packages/analyze/README.md, README.md, docs/adr/**, docs/proposals/start-framework.md, CONTEXT.md, packages/cli/llms.md]

## Description
Finish the documentation and status work of ADR 0053 once the code exists.

**Size:** M
**Files:** `apps/docs/content/docs/server-services.mdx`, `vite.mdx`, `errors.mdx`, `testing.mdx`, `index.mdx`, `meta.json` and a new Controllers guide with type-checked snippets, `packages/start/README.md`, `packages/ui-vite/README.md`, `packages/analyze/README.md`, `README.md`, `docs/adr/README.md`, `docs/adr/0053-file-routed-controllers.md`, `docs/proposals/start-framework.md`, `packages/cli/llms.md`

### Approach
- Docs pages: `server-services.mdx:21,27,37-42,60,62-66` (the request-services list gains `ResponseStatus`, the generated modules gain `virtual:sleek/server-app`, the boundary list gains Controllers, testing gains `callController`); `vite.mdx:8-17,27-31,41-56` (options `serverDir`, `controllersDir`); `errors.mdx`, `testing.mdx:9`, `index.mdx:18`. A new guide must be listed in `meta.json`, use `<include>` of type-checked `apps/docs/snippets/**` (no inline fences), and any snippet using a virtual module needs a committed declaration beside it.
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
