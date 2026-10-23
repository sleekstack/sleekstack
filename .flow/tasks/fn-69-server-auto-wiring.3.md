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
- Implementation-Layer builder: captures the non-request services once at Layer build (`Effect.context`, as realworld's `*-api.server.ts` does at `identity-api.server.ts:52-66`) and provides the request services per call, inside the file's or Manifest's `wrap` (`RpcWrap`, type-preserving, from the sibling spec's task 5). Every call path runs inside it: wire calls, in-process calls from loaders and `callService`. `implement.ts:5-9` caps R at the request services and is not reused. <!-- Updated by plan-sync: fn-68-file-routed-controllers.5 added `ResponseStatus` to `RequestServices` (`services.ts:55`), and `requestServices(request).layer` (`services.ts:102-130`) provides all four per call, so the builder provides that one layer and `ResponseStatus.set` is harmless on the RPC face (R6: no effect). `RpcWrap` is already shipped and exported (`app.ts:54`, `index.ts:5`; `<A, E, R>(next: Effect<A, E, R>, request) => Effect<A, E, any>`): do not add it. `ControllerOptions.wrap` is typed `Wrap`, which is Response-typed (`app.ts:61`), so the RPC File and Manifest options need their own type with `RpcWrap`. `ServerServiceShape` and `ServerServiceMethods` (`service.ts:8-17`) require `R = never`, so the generated Tag's type, which erases `R`, is a variant of them -->
- `rpc(...)` helper for the Manifest default export: an identity function whose route names are typed from the generated route table (an ambient type the declaration fills; add a `*.test-d.ts`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.7 and .8: the generated declaration already has the table, `interface Controllers` (route name to pattern) and `interface ControllerModules` (route name to `typeof import(...)` of the Controller module, so `keyof ControllerModules[route]` gives the verbs it exports), but only while a Controller exists and only from the generated file: start declares nothing but `default` in `server-app.ts`. A type that start itself reads must be an interface that `server-app.ts` declares empty and the generated declaration merges into --> <!-- Updated by plan-sync: fn-69-server-auto-wiring.2: the analyzer accepts the Manifest default export as an object literal or `rpc(<object literal>)`, matching the callee by name only because this helper does not exist yet. Export it as `rpc` from `packages/start/src/index.ts`; pinning the analyzer to this declaration is left to a later task -->
- Wire configuration (`wire.ts:82-114`): the origin allow-list is the union of `start({ origins })` and every discovered `origins` export; `bodyLimit` resolves per registered id by specificity; keep the order method, origin, registered id, body size, JSON, input so an unknown id never leaks. <!-- Updated by plan-sync: fn-68-file-routed-controllers.6 already unions `start({ origins })` with every Controller file's `origins` and validates every `bodyLimit` (a positive integer, naming `ControllerOptions.file`) inside the memoized first-request load (`start.ts:122-135`, where `chain` is `controllers.flatMap(options)`): extend that code over the RPC File and Manifest options, do not write a second. `endpoint(functions, { origins, bodyLimit })` takes one app-wide limit and reads the body at `wire.ts:102`, after the registered-id lookup (`:100-101`), so a per-id limit goes there with the order of checks unchanged. `readBody` and `decodeError` are exported from `wire.ts`. The TSDoc of `StartOptions.origins` and `bodyLimit` (`start.ts:46-56`) names Controller files only -->
- `start` option typing (`start.ts:19-24,29-59`): the explicit `layer` may require services that Layer Files provide (the declaration carries the provided Tag union); `services` de-duplication by Tag is the sibling spec's. Wire `onError` from the Server Root. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 and .6. (1) `DiscoveredApp` (`app.ts:84-89`) holds only `controllers` and `router?`, and start reads it on the first request through the `./discovered` stand-in (`discovered.ts`), which the plugin redirects only for an importer matching `start/(dist|src)/start.[jt]s` (`START_MODULE`, `server-services.ts:34`): keep that import in `start.ts` or update the regex. Define here the fields that tasks 4 to 6 emit: the composed `layer`, the generated `services` entries, `onError` from the Server Root and the RPC options. (2) `registry([...])` is built at the `start()` call (`start.ts:115-119`), so `DuplicateServerFn` and `InvalidServerFnId` throw synchronously, and explicit `services` are de-duplicated by Tag there (first entry wins). Discovered services exist only after the first-request discovery, so their functions join the registry inside the memoized load, de-duplicated by Tag against `options.services`. (3) `configureRuntime({ layer, isControlFlow, onError })` also runs at the `start()` call (`start.ts:137-141`), but the composed Layer and the Server Root's `onError` are known only after discovery: move it into the memoized load (fn-68-file-routed-controllers.1 left this). `@sleekstack/testing`'s `serve()` calls `start({ router: noPages, ...options }).fetch(request)` and always passes `layer` and `onError`, so an explicit `layer` must shadow the discovered Layer and an explicit `onError` must beat the Server Root's. (4) The stage requirements `RP | RH | RM | RF` (`Needs<R>`, `start.ts:17`) must also be satisfied by the Tags the discovered app provides (a page's loader calls `yield* Comments`), not only by the explicit `layer`'s `RIn`, or every such app must still give a `layer` providing the generated Tags -->

- `rpc(...)` helper for the Manifest default export: an identity function whose route names are typed from the generated route table (an ambient type the declaration fills; add a `*.test-d.ts`).
- Wire configuration (`wire.ts:81-113`): the origin allow-list is the union of `start({ origins })` and every discovered `origins` export; `bodyLimit` resolves per registered id by specificity; keep the order method, origin, registered id, body size, JSON, input so an unknown id never leaks.
- `start` option typing (`start.ts:18-22`): the explicit `layer` may require services that Layer Files provide (the declaration carries the provided Tag union); `services` de-duplication by Tag is the sibling spec's. Wire `onError` from the Server Root.
- Public exports get TSDoc and `api-coverage` entries; run the fixture graph check.

### Investigation targets
**Required** (read before coding):
- `packages/start/src/implement.ts:1-38`
- `packages/start/src/wire.ts:43-114`
- `packages/start/src/service.ts:7-17,40-55`
- `packages/start/src/start.ts:15-176` - options, the memoized load, `configureRuntime`, the pipeline
- `packages/start/src/app.ts`, `server-app.ts`, `discovered.ts` - `DiscoveredApp`, `ControllerEntry`, `ControllerOptions`, the ambient module, the stand-in
- `apps/realworld/server/identity-api.server.ts:18-66`
- `.flow/memory/bug/integration/package-reaching-a-virtual-module-needs-2026-10-22.md` - the stand-in and its redirect

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
Added the runtime the generated code calls: `serviceLayer(tag, methods, wrap?)` (build services captured once without the build Scope, request services from each call's fiber, every call inside the `RpcWrap` on the wire and in process) and `rpc(services, options)` for the RPC Manifest, with route names typed from `ControllerModules`. `DiscoveredApp` now carries `layer`, `services` (`DiscoveredService`: entry, implementation Layer, option chain) and `onError`. `start` composes them on the first request, with the explicit `layer` winning and allowed to require `LayerFileServices`. The wire resolves `bodyLimit` per registered id, and `origins` are a union over every option chain.

Notes for tasks 4 to 6: `rpc(...)` returns `{ services, options }`, not the bare table, so the Manifest's `wrap`, `bodyLimit` and `origins` can be read at run time; the plain object-literal default export has no options. The generated declaration fills `ControllerModules` (already written), `LayerFileServices` and `GeneratedServices` (Tag key to Tag type) in `virtual:sleek/server-app`. Shadowed Layer Files are still built. The explicit `layer` must not require a generated Tag.

Tests: `packages/start/src/__tests__/rpc.test.ts` (builder, wrap on the wire and in process, typed error as the Exit failure, the Server Root's `onError` against an explicit one, explicit layer shadowing, de-duplicated `services`, `origins` union, unknown id or cross-origin with no leak, per-id `bodyLimit`, invalid `bodyLimit` naming the file), `rpc.test-d.ts` (route names), `layer.test-d.ts` (Layer File requirement). Fixture graph diff empty.

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
## Evidence
- Commits: f94403eddbc68f41883f95d985e678f2dad0240f
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start..., pnpm --filter docs test, pnpm format:check, fixture graph check: diff empty
- PRs: