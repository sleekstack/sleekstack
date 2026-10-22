---
satisfies: [R6, R8, R13]
---
# fn-69-server-auto-wiring.3 start: rpc helper, generated-Layer runtime, wire configuration and layer typing

Touches: [packages/start/src/**]

## Description
The runtime support the generated code calls: a builder for the implementation Layer, the `rpc` helper, the per-service wire configuration and the typing of `layer` (R6, R8, R13).

**Size:** M
**Files:** `packages/start/src/rpc.ts` (new), `packages/start/src/start.ts`, `packages/start/src/wire.ts`, `packages/start/src/service.ts`, `packages/start/src/index.ts`, `packages/start/src/__tests__/` (new `rpc.test.ts`, `wire` and `start` tests, `*.test-d.ts`)

### Approach
- Implementation-Layer builder: captures the non-request services once at Layer build (`Effect.context`, as realworld's `*-api.server.ts` does at `identity-api.server.ts:52-66`) and provides the request services per call, inside the file's or Manifest's `wrap` (`RpcWrap`, type-preserving, from the sibling spec's task 5). Every call path runs inside it: wire calls, in-process calls from loaders and `callService`. `implement.ts:5-9` caps R at the request services and is not reused.
- `rpc(...)` helper for the Manifest default export: an identity function whose route names are typed from the generated route table (an ambient type the declaration fills; add a `*.test-d.ts`).
- Wire configuration (`wire.ts:81-113`): the origin allow-list is the union of `start({ origins })` and every discovered `origins` export; `bodyLimit` resolves per registered id by specificity; keep the order method, origin, registered id, body size, JSON, input so an unknown id never leaks.
- `start` option typing (`start.ts:18-22`): the explicit `layer` may require services that Layer Files provide (the declaration carries the provided Tag union); `services` de-duplication by Tag is the sibling spec's. Wire `onError` from the Server Root.
- Public exports get TSDoc and `api-coverage` entries; run the fixture graph check.

### Investigation targets
**Required** (read before coding):
- `packages/start/src/implement.ts:1-37`
- `packages/start/src/wire.ts:43-113`
- `packages/start/src/service.ts:41-51`
- `packages/start/src/start.ts:15-50`
- `apps/realworld/server/identity-api.server.ts:18-66`

**Optional**:
- `packages/start/src/__tests__/implement.test.ts`, `layer.test-d.ts`

## Acceptance
- [ ] a generated-style Layer built with the builder: build services resolve once, request services per call, a `wrap` that provides a service from `Cookies` applies on the wire and on an in-process call, and a typed error crosses the wire as the Exit failure
- [ ] an unknown id and a cross-origin call answer as before (no id leak); `origins` union and per-id `bodyLimit` are tested
- [ ] `layer` typing test: an explicit `layer` requiring a Layer File service typechecks, one requiring an unprovided service does not
- [ ] `rpc` route names are type-checked against a table (`*.test-d.ts`)
- [ ] the fixture graph check diff is empty or only the added exports
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
