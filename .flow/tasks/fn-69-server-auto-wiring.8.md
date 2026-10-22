---
satisfies: [R11]
---
# fn-69-server-auto-wiring.8 showcase: Tally as a Controller and the RPC Manifest

Touches: [apps/showcase/server/**, apps/showcase/src/pages/tally.ts, apps/showcase/src/pages/server.tsx, apps/showcase/test/**, apps/showcase/vite.config.ts, apps/showcase/README.md]

## Description
Prove the Manifest on a real consumer: showcase's `Tally` becomes a Controller plus a Manifest entry (R11).

**Size:** M
**Files:** `apps/showcase/server/routes/api/tally.controller.ts` (new), `apps/showcase/server/rpc.ts` (new), `apps/showcase/server/tally.layer.ts` (new, holds the tally `Ref`), `apps/showcase/server/routes/api/_defaults.ts` (new), `apps/showcase/server/app.ts`, `apps/showcase/server/tally.server.ts` (deleted), `apps/showcase/server/dev.ts`, `apps/showcase/src/pages/tally.ts`, `apps/showcase/src/pages/server.tsx`, `apps/showcase/test/server.test.ts`, `apps/showcase/test/size.test.ts`, `apps/showcase/test/architecture.test.ts`

### Approach
- Controller `GET`/`POST /api/tally` answers bare numbers; `read` and `add` become the Manifest's `Tally.read` and `Tally.add`; the wire ids stay. Keep `TallyLimit` client-safe in `src/pages/tally.ts` and delete the `Tally` contract there.
- The tally state lives in a Layer File so both faces share it; a showcase `_defaults.ts` `wrap` maps `TallyLimit` to 409 with `{ limit }` for REST.
- Page: `tally.add({ by: 1 })` becomes `tally.add({ body: { by: 1 } })` (`server.tsx:56`), importing the Tag from `virtual:sleek/rpc`. Keep `client(addItem)` and the `serverFn` untouched (`server.tsx:8-9`).
- Dev server forwards Controller paths through the plugin predicate (`server/dev.ts:12` forwards only `/_sleek/` today); update `server.test.ts` (`:75-77` bodies become `{ body: { by } }`, `:95`, `:102-121`), the client-chunk test (`size.test.ts:30-48,107-125`: `serverServices()` plugin list, markers, no `server/` module in the client) and the architecture test for `virtual:sleek/rpc`.

### Investigation targets
**Required** (read before coding):
- `apps/showcase/server/app.ts:1-32`, `tally.server.ts:7-16`, `src/pages/tally.ts:5-17`, `src/pages/server.tsx:53-81`
- `apps/showcase/test/server.test.ts:70-125`, `test/size.test.ts:30-125`

**Optional**:
- `apps/showcase/test/architecture.test.ts:55-66`

## Acceptance
- [ ] `GET` and `POST /api/tally` answer bare numbers; a past-limit `by` answers 409 `{ limit }`
- [ ] the page, the wire id `Tally.add` and the typed `TallyLimit` behave as before with the nested input
- [ ] the client-chunk bundle test passes and covers the generated modules; no `server/` module reaches the client
- [ ] `pnpm turbo run test typecheck --filter=showcase` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
