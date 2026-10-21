---
satisfies: [R1, R2, R4, R8, R9]
---
# fn-66-server-services-di-style-server.7 showcase Server Service example, client bundle test, docs guide and README

## Description
The end-to-end proof and the finalization: one real Server Service in the showcase with no hand-written Schema, id, `functions` entry or stub; a build test that the client chunk holds no `*.server.ts`; the docs guide, the start README rows and the regenerated API pages. Finalization (docs, README, generated API) is part of this task, not a separate one.

**Size:** M
**Files:** apps/showcase/vite.config.ts, apps/showcase/src/pages/<contract>.ts (new), apps/showcase/server/<impl>.server.ts (new), apps/showcase/server/app.ts, apps/showcase/src/layers.ts, apps/showcase/src/pages/server.tsx, apps/showcase/test/server.test.ts, apps/showcase/test/size.test.ts or a sibling build test, apps/docs/content/docs/server-services.mdx (new), apps/docs/content/docs/meta.json, packages/start/README.md, apps/docs/content/docs/api/ (regenerated only)
**Touches:** [apps/showcase/**, apps/docs/content/docs/server-services.mdx, apps/docs/content/docs/meta.json, packages/start/README.md, apps/docs/content/docs/api/**]

### Approach
- Showcase: add the standalone `serverServices` plugin to `vite.config.ts` beside `react()`. Contract: a small counter service with one declared error (a limit), in a client-safe file under `src/pages/`; implementation as a Layer in a `*.server.ts` under `server/`; `server/app.ts` adds the generated registry as `services` and the Layer to the server Layer; the browser's layers add `virtual:sleek/server`. A `TallyDemo`-style section in `src/pages/server.tsx` beside the existing server-function demo (leave that demo: `serverFn` stays).
- Tests: extend `test/server.test.ts` (the dev-server middleware path that already answers `POST /_sleek/fn/<id>`) for the new service end to end, plus `callService` against a test Layer for the DI path with no network. Add the client-bundle build test: build the showcase client and assert no `*.server.ts` source and no server-only Layer in any emitted chunk (see how `size.test.ts` builds).
- Docs: a guide page modeled on the existing guides (concepts, routing, vite), added to `meta.json`; its example is type-checked by `apps/docs/test/examples.test.ts`. State plainly what a Server Service does not do (refinements, request services, streaming) and when `serverFn` is the tool.
- `packages/start/README.md`: rows for `ServerService`, `taggedError`, `services`, `serverClient(s)`. Run `generate:api` for the API pages; never hand-edit them.
- Run the AGENTS.md fixture graph check before this task starts and after it ends; the output must match.

### Investigation targets
**Required** (read before coding):
- `apps/showcase/server/app.ts` — the current server entry and Layer wiring
- `apps/showcase/src/pages/server.tsx`, `items.ts` — the existing demo the new one sits beside
- `apps/showcase/vite.config.ts` — plugin list
- `apps/showcase/test/server.test.ts`, `size.test.ts` — end-to-end and build test patterns
- `apps/docs/test/examples.test.ts` — how guide examples are checked

**Optional** (reference as needed):
- `apps/realworld/src/pages/functions.ts` — a hand-written DI wrapper over `client` that a Server Service generalizes; a later migration, not this task

## Acceptance
- [ ] The new showcase service has no hand-written Schema, id, `functions` entry or client stub (reviewable in the diff).
- [ ] Test: the form or DI call through the dev middleware adds and reads, shows the declared error typed, and `callService` with a test Layer passes without network.
- [ ] Build test: the showcase client output contains no `*.server.ts` source and no server Layer; it fails if one is imported from client code.
- [ ] The docs guide exists, is in `meta.json`, and its example passes `examples.test.ts`; `packages/start/README.md` lists the new exports; `generate:api` was run and its output committed.
- [ ] Fixture graph check output is identical before and after.
- [ ] `pnpm turbo run test typecheck --filter=showcase`, `pnpm turbo run test typecheck build --filter=docs` and `pnpm turbo run test typecheck --filter=@sleekstack/start...` pass.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
