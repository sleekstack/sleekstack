---
satisfies: [R5, R6, R12]
---
# fn-69-server-auto-wiring.5 ui-vite: RPC Manifest codegen and typed route table

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/**, packages/start/src/__tests__/**, packages/analyze/src/controllers.ts]

## Description
Generate Server Services from the server directory's `rpc.ts` by wrapping Controller Methods (R5, R6, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture `rpc-manifest/`, a `*.test-d.ts` for the typed route names

### Approach
- Read the Manifest through the analyzer (task 2): for each `Service: { method: 'VERB route-name' }` take the Controller method's Schemas from the shared reader. Input variants: a printed `number` is a plain number on the wire, a referenced Schema is used as written on both faces; the wire input is the Controller's `{ params?, query?, body? }`, none when the Controller declares none. <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 and .8. The plugin reads Controllers through `readControllers` (`server-services.ts:298-305`: a `Map` by route name of `{ name, schema: { input, success } }`, joined to `discoverControllers`' `{ file, route, pattern, defaults }` on `route`, as `appCode` does), and that `schema.input` is the HTTP face's: the `number` and `boolean` leaves of `params` and `query` carry `codec: 'string'` (printed as the finite-decimal transform and `Schema.BooleanFromString`), `schema.success` is undefined without a written return type, and `E` is never read. A wrapped method needs the plain-number input, the success Schema and the tagged errors, so task 2's Manifest pass has to supply them (a second read of the signature, or the unmarked input and the errors on `analyzeControllers`' result; `controllers.ts` is outside the Touches of both tasks). Emit the Manifest's input from that, never from the marked one. `defined()` (`:307-312`: an optional `params` or `query` decodes as its defined members) is the HTTP face's rule only: the wire input is the Controller's `{ params?, query?, body? }` as written --> <!-- Updated by plan-sync: fn-69-server-auto-wiring.2 built the Manifest pass, so the supply this note asks for exists and `controllers.ts` needs no edit for it. `analyzeRpc({ project, serverDir?, controllersDir? })` (`rpc.ts`, exported from `@sleekstack/analyze` with `RpcReport`, `RpcServiceDecl`, `RpcMethod`) returns Manifest services after the RPC File services, each `{ name, file (the Manifest), location, methods }`; a method is `{ name, location, input, success, error, requires (ts.Type), schema: MethodSchema (plain-number input, success, tagged errors), controller?: { route, method } }`. Emit the Manifest from `schema`, never from `readControllers`. The pass re-reads the signature with the RPC options through `signatureOf`, which fn-69.2 exported from `controllers.ts` (with `METHODS` and `CONTROLLER`, not from `index.ts`). A wrapped method with its own error is reported once, at the Manifest entry. The pass does not read the Manifest options (`wrap`, `bodyLimit`, `origins`), and accepts the `rpc(...)` callee by shape (the identity helper is task 3's): read the options in this task or task 4 from the Manifest's default export, and pin the callee by declaration once task 3 has written it -->
<!-- Updated by plan-sync: fn-69-server-auto-wiring.2: `sleekstack check` (`packages/cli/src/check.ts`) does not call `analyzeRpc` yet. No downstream task lists `packages/cli/src/check.ts` in Touches; the conductor must widen one (task 4 is the earliest consumer of the pass) -->

- The implementation Layer runs the Controller method inside the Manifest's `wrap` (an `RpcWrap`), never the directory `wrap`; typed errors cross as the Exit failure; `ResponseStatus` has no effect. The generated code reuses the start builder (task 3).
- The generated route table (route names and verbs) fills the ambient type of the `rpc` helper so a renamed Controller is a type error; dev edits to `rpc.ts` or to a wrapped Controller regenerate. <!-- Updated by plan-sync: fn-68-file-routed-controllers.7 and .8: the table already exists as `interface Controllers` and `interface ControllerModules`, written by `controllersDeclaration` (`server-services.ts:375-390`) only while a Controller exists, and declared by the generated file alone (see task 3's note on what start's own types may read). A Controller edit already invalidates `virtual:sleek/server-app` (`discoveryFile`, `:570-572`); `rpc.ts` needs the same, which task 4 widens. A wrapped method's `R` may name services that only the directory `wrap` of its Controller provides (such as realworld's `Viewer`): the RPC face never applies that `wrap`, so the Manifest's own `wrap` has to provide them -->

- Add a test where a Manifest `wrap` provides a service read from `Cookies`: a typed error crosses the wire and an in-process call is wrapped too.

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:141-180,291-390` - entriesCode, declarationOf, `readControllers`, `appCode`, `controllersDeclaration`
- the sibling spec's Controller codegen (task 8 of fn-68): the fixture `fixtures/controller-app/` and its test 'serves a generated entry through start()'
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
