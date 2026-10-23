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

- The implementation Layer runs the Controller method inside the Manifest's `wrap` (an `RpcWrap`), never the directory `wrap`; typed errors cross as the Exit failure; `ResponseStatus` has no effect. The generated code reuses the start builder (task 3). <!-- Updated by plan-sync: fn-69-server-auto-wiring.3: the builder is `serviceLayer(tag, methods, wrap?)`, and the `rpc` helper is shipped: `rpc(services, options?)` returns `{ services, options }` (`RpcManifest`, options `RpcManifestOptions = { wrap?: RpcWrap, bodyLimit?, origins? }`), not the bare table, so the Manifest's `wrap`, `bodyLimit` and `origins` are read at run time from the default export's `options` by the generated code (a plain object-literal default export has none). `RpcRoute` (`'VERB route-name'`) is typed from `ControllerModules`, which `server-app.ts` already declares empty for the generated declaration to merge into: only the declaration needs to fill it, nothing to add in start. `DiscoveredService.options` omits `wrap`; pass the Manifest's `wrap` to `serviceLayer` -->.
- The generated route table (route names and verbs) fills the ambient type of the `rpc` helper so a renamed Controller is a type error; dev edits to `rpc.ts` or to a wrapped Controller regenerate. <!-- Updated by plan-sync: fn-68-file-routed-controllers.7 and .8: the table already exists as `interface Controllers` and `interface ControllerModules`, written by `controllersDeclaration` (`server-services.ts:375-390`) only while a Controller exists, and declared by the generated file alone (see task 3's note on what start's own types may read). A Controller edit already invalidates `virtual:sleek/server-app` (`discoveryFile`, `:570-572`); `rpc.ts` needs the same, which task 4 widens. A wrapped method's `R` may name services that only the directory `wrap` of its Controller provides (such as realworld's `Viewer`): the RPC face never applies that `wrap`, so the Manifest's own `wrap` has to provide them -->

<!-- Updated by plan-sync: fn-69-server-auto-wiring.4 shipped the RPC File side in `server-services.ts`; build the Manifest on it. `readRpc` (`:283-320`) returns `{ services: [], code: '' }` at once when no `*.rpc.ts` is under `serverDir`, and filters the analyzer's services with `RPC_FILE.test(s.file)`: both must admit a Manifest service (`file` is `rpc.ts`) or a Manifest-only app generates nothing. The Tag is `export const <Name> = Context.GenericTag("<Name>")` in the generated `virtual:sleek/rpc` (`:311`), imported by `virtual:sleek/server`, `virtual:sleek/server-registry` and `virtual:sleek/server-app` (one Tag object); add the Manifest's Tags there. Registry and client entries come from the shared `entryCode(c, alias)` (`:147`) with `contract: { name, file: RPC, methods: [{ name, schema }] }`. The discovered app's `services` is a lazy getter (`get services()`, `:457`, memoized `??=`) because `@sleekstack/start` is still evaluating when it imports the module: keep Manifest entries in that getter, each `{ entry, layer: serviceLayer(Tag, { methods }, wrap), options: [_defaults.ts chain, file options] }` (`:445`, `defaultsOf`/`defaultsChain` give the chain). `sleekstack check` already runs `analyzeRpc` (`rpcErrors`, `check.ts:113,163`), so Manifest errors need no `check.ts` edit. `discoveryFile` already covers `rpc.ts` and `_app.ts`. The declaration keeps being byte-identical for an app without RPC services -->

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
`rpc.ts` under serverDir now generates one Server Service per Manifest service: a Tag in `virtual:sleek/rpc`, a registry entry and client, and a `serviceLayer` over the wrapped Controller Methods that runs inside the Manifest's own `wrap`. The wire id is `<Service>.<method>`, and `bodyLimit` and `origins` are read from `rpc(...)`'s default-export options. The declaration types each Manifest Tag from the Controllers' modules, so renaming a Controller is a type error at the `rpc.ts` route string.

Tests (`packages/ui-vite/src/__tests__/server-services.test.ts`, 'the RPC Manifest', fixture `rpc-manifest/`):
- the three-part `{ params, body }` input and a no-input method
- a cookie-read `wrap`, with the typed error crossing as the Exit failure
- the directory `wrap` not applied on the RPC face but kept on REST
- the bodyLimit returning 413
- an in-process call wrapped too
- the committed declaration
- the type error on rename, checked through the TS program in vitest rather than a separate `*.test-d.ts`

Continuation: the original worker committed 25af7d78 and died before recording a receipt. This worker re-checked every AC against the commit and re-ran all gates with `--force`. No code changes were needed.

baseline: not re-run (continuation; task code already committed at 25af7d78; post-commit gates all green)
stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - ran (sonnet; updated task 6)
Tier: session (jev-unavailable(no_key)); routing block sets opus at medium
## Evidence
- Commits: 25af7d78c26925d75c8a8f43dd581a2247c90859
- Tests: pnpm turbo run test typecheck --force --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld --filter=showcase, pnpm --filter realworld check, pnpm turbo run test typecheck build --force --filter=docs --concurrency=1, pnpm --filter docs test, pnpm --filter docs build, pnpm format:check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts)
- PRs: