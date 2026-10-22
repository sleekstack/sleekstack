# fn-69-server-auto-wiring.11 docs, ADR status, README and llms.md finalization for auto-wiring

Touches: [apps/docs/content/docs/**, apps/docs/snippets/**, apps/docs/test/**, packages/start/README.md, packages/ui-vite/README.md, packages/analyze/README.md, apps/realworld/README.md, apps/showcase/README.md, docs/adr/**, CONTEXT.md, packages/cli/llms.md]

## Description
Finish the documentation and status work of ADR 0054 once the code exists.

**Size:** M
**Files:** `apps/docs/content/docs/server-services.mdx`, `vite.mdx`, `errors.mdx`, `testing.mdx`, `meta.json`, a new RPC and auto-wiring guide with type-checked snippets under `apps/docs/snippets/**`, the READMEs of start, ui-vite, analyze, realworld and showcase, `docs/adr/README.md`, `docs/adr/0054-server-auto-wiring.md`, `docs/adr/0053-file-routed-controllers.md`, `CONTEXT.md`, `packages/cli/llms.md`

### Approach
- Rewrite the "nothing is auto-discovered" statement (`server-services.mdx:21`) and document Layer Files, the Server Root, RPC Files, the RPC Manifest, `virtual:sleek/rpc` and `virtual:sleek/server-app`, with snippets that typecheck (a snippet using a virtual module needs a committed declaration beside it; the guides test forbids inline code fences).
- Bring the ADRs in line with what shipped: Directory Defaults `wrap` is Controllers only while `bodyLimit` and `origins` also reach RPC; `origins` only adds; the shape code `ServerFileShape`; the test-exclusion list; the PascalCase rule. Flip ADR 0054 to `Accepted` with `Built in spec fn-69` and update the README row; check CONTEXT.md terms against the final behaviour.
- Confirm `cli/llms.md` is under its cap after all new rows; run the docs tests and build with `--concurrency=1`.

### Investigation targets
**Required** (read before coding):
- `apps/docs/content/docs/server-services.mdx`, `apps/docs/test/examples.test.ts`, `guides.test.ts`, `api-coverage.test.ts`
- `docs/adr/0053-file-routed-controllers.md`, `docs/adr/0054-server-auto-wiring.md`

**Optional**:
- `apps/docs/snippets/server-services/server.gen.d.ts`

## Acceptance
- [ ] the docs describe every new file kind and virtual module with type-checked snippets
- [ ] ADR 0054 is Accepted with its spec id; ADR 0053 and CONTEXT.md match the shipped behaviour
- [ ] `cli/llms.md` is under its cap
- [ ] `pnpm turbo run test typecheck build --filter=docs --concurrency=1` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
