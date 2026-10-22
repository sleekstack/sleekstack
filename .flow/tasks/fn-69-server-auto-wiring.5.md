---
satisfies: [R5, R6, R12]
---
# fn-69-server-auto-wiring.5 ui-vite: RPC Manifest codegen and typed route table

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/**, packages/start/src/__tests__/**]

## Description
Generate Server Services from the server directory's `rpc.ts` by wrapping Controller Methods (R5, R6, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture `rpc-manifest/`, a `*.test-d.ts` for the typed route names

### Approach
- Read the Manifest through the analyzer (task 2): for each `Service: { method: 'VERB route-name' }` take the Controller method's Schemas from the shared reader. Input variants: a printed `number` is a plain number on the wire, a referenced Schema is used as written on both faces; the wire input is the Controller's `{ params?, query?, body? }`, none when the Controller declares none.
- The implementation Layer runs the Controller method inside the Manifest's `wrap` (an `RpcWrap`), never the directory `wrap`; typed errors cross as the Exit failure; `ResponseStatus` has no effect. The generated code reuses the start builder (task 3).
- The generated route table (route names and verbs) fills the ambient type of the `rpc` helper so a renamed Controller is a type error; dev edits to `rpc.ts` or to a wrapped Controller regenerate.
- Add a test where a Manifest `wrap` provides a service read from `Cookies`: a typed error crosses the wire and an in-process call is wrapped too.

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:92-135`
- the sibling spec's Controller codegen (task 8 of fn-68)
- `apps/showcase/src/pages/tally.ts:5-17`, `apps/showcase/server/tally.server.ts:7-16` - the first consumer

**Optional**:
- `packages/analyze/src/rpc.ts` (task 2)

## Acceptance
- [ ] a Manifest over a fixture Controller generates the Tag, entry, Layer and client; the wire id is `<Service>.<method>`
- [ ] a Controller with `params` and `body` wraps to a three-part input; a method with no input takes none
- [ ] the `wrap` test above passes on the wire and in process; the directory `wrap` is not applied
- [ ] renaming a Controller in the fixture is a type error in `rpc.ts` (`*.test-d.ts`)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... --filter=@sleekstack/start...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
