---
satisfies: [R3, R4, R6, R12]
---
# fn-69-server-auto-wiring.4 ui-vite: RPC File codegen (Tag, registry entry, implementation Layer, client, virtual:sleek/rpc)

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/**, packages/cli/src/check.ts, packages/cli/src/__tests__/**]

## Description
The early proof point: one written signature in a `*.rpc.ts` file produces the Tag, the registry entry, the implementation Layer and the browser client through the plugin (R3, R4, R6, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/index.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture `rpc-files/`

### Approach
- Discover `*.rpc.ts` under the server directory (the `serverDir` option from the sibling spec); one Tag object per service, shared by every generated module (`virtual:sleek/rpc`, `virtual:sleek/server`, `virtual:sleek/server-registry`, `virtual:sleek/server-app`); showcase compares Tags by identity. <!-- Updated by plan-sync: fn-68-file-routed-controllers.7 and .8. Today `virtual:sleek/server` and `virtual:sleek/server-registry` each import every Tag from its contract file (`entriesCode`) and `virtual:sleek/server-app` imports no Tag, so identity comes from the one source module. A generated Tag has no source file: put it, and the client, in client-safe generated code that every module imports, never in code that imports the server-only RPC File. The server side imports the RPC File eagerly, as `appCode` imports each Controller (`alias(file, '*')`, `server-services.ts:320-368`). `discoverControllers` scans the files under `serverDir` and `controllersDir` (`filesUnder`, `:226-230`) and computes each file's `_defaults.ts` chain with `defaultsOf` (`:253-260`, private), which an RPC File needs for its inherited `bodyLimit` and `origins` --> <!-- Updated by plan-sync: fn-69-server-auto-wiring.2 shipped the analyzer side. Read the files through `analyzeRpc({ project, serverDir?, controllersDir? })` (`@sleekstack/analyze`): `services[]` is `{ name (Tag name, also the wire id prefix), file, location, methods[] }` with each method `{ name, location, input, success, error, requires, schema: MethodSchema }`; its `errors` fail the module load with `file:line`. A refusal comes as `RpcMethodShape`, `RpcRouteUnknown`, `RpcNameCollision` or `ServerFileShape` (bad service name, non-literal `service`, bad Manifest), and a Schema or tagged error class from a server-only module as `ServerFileInClientGraph` (chain `virtual:sleek/rpc -> <file>`). `SERVER_ONLY` already lists the kinds `rpc` and `layer` and the reserved names `rpc` and `_app`, and `virtual:sleek/rpc` is a browser-entry marker, so the plugin's load guard needs no list edit. Not read by the analyzer: the `wrap`, `bodyLimit` and `origins` options of an RPC File. Also: `sleekstack check` (`packages/cli/src/check.ts`) does not call `analyzeRpc` yet and the file is in no task's Touches; this task is the first consumer of the pass, so the conductor should add `packages/cli/src/check.ts` and its test to this task's Touches (wire it as `analyzeLayerFiles` is, `check.ts:110`) -->

- Registry entries from the shared reader through `entriesCode` (`server-services.ts:141-158`, sharing `importMap`, `:63-79`, with the Controller entries; `Contract`, `:43-54`, has a class `name` and `file` that a generated service lacks); the implementation Layer calls the start builder (task 3) with the file's exports and its `wrap`, never re-implementing the split <!-- Updated by plan-sync: fn-69-server-auto-wiring.3 shipped it as `serviceLayer(tag, methods, wrap?)` from `@sleekstack/start` (`rpc.ts`): `methods` is the RPC File's exports object (each `(input?) => Effect`, at most one input), `wrap` an `RpcWrap` or undefined, and the Tag must be `Context.Tag<Id, GeneratedServiceShape<typeof methods>>` (also exported: the mapped type with `R` erased and `NetworkError | DecodeError` added, so the declaration reuses it rather than writing its own). The generated Layer has `RIn` of the non-request services, so each entry of `DiscoveredService` is `{ entry: ServerServiceEntry, layer, options }` where `options` is the `_defaults.ts` chain then the file's own `bodyLimit` and `origins`, without `wrap`, outermost first (`app.ts`). Emit them as `services` in the `virtual:sleek/server-app` default export; start de-duplicates by Tag against `options.services` and unions the `origins` itself -->; the browser client uses `serverClients` (`start/client.ts:120-136`) and imports only client-safe modules. <!-- Updated by plan-sync: fn-68-file-routed-controllers.7 and .8 moved the references -->
- The declaration types each Tag by a mapped type over the RPC File's exports with `R` erased and `NetworkError | DecodeError` added (today it names a class by `import()` in `declarationOf`, `:166-180`); services and methods are sorted for a stable committed file. <!-- Updated by plan-sync: fn-68-file-routed-controllers.7: `writeDeclaration(g, d)` (`:477-491`) is the one writer of the whole file, the Server Services section from `Generated` and the Controllers section from `Discovered`. It writes nothing while either fails (the previous file stays), writes no file while there are no contracts and no Controllers, and adds `and the Controllers` to the header only when Controllers exist, so a file without them is byte-identical. Add the RPC section the same way: the committed `server.gen.d.ts` of realworld, showcase and the docs snippets must not change while they have no RPC File. An analyzer error of the RPC pass fails the module load with `file:line`, as `discover()` does (`:425-438`, `failed(...)`). Start from the fixture `fixtures/controller-app/` (committed `src/server.gen.d.ts`; tests 'serves a generated entry through start()' and 'writes the committed declaration of the fixture') -->
<!-- Updated by plan-sync: fn-69-server-auto-wiring.3: the generated declaration also fills the two interfaces that `server-app.ts` declares empty in `virtual:sleek/server-app`: `GeneratedServices` (each generated Tag, key to Tag type) and `LayerFileServices` (task 6), and `ControllerModules` as before. `StartOptions` excludes both from `Needs`, so a page loader's `yield* Comments` typechecks without a `layer`; an explicit `layer` must not require a generated Tag. Shadowed Layer Files are still built -->
- Dev: a `*.rpc.ts` add, remove, rename or edit regenerates and invalidates the new virtual modules; the watch predicate is separate from the server-only guard (the dev `changed` handler, `:556-581`, skips only `IMPLEMENTATION`, which is `*.server.*`, `:40`, so a `*.rpc.ts` edit already reaches it). <!-- Updated by plan-sync: fn-68-file-routed-controllers.7 and .8. `MODULES = [CLIENT, REGISTRY]` (`:22`) is the invalidation set and `VIRTUAL` (`:28`) the resolve and load filter, so `virtual:sleek/rpc` joins `MODULES`. `virtual:sleek/server-app` is invalidated apart: when the `discovered` result differs before and after, and for an edit that leaves it as it was through `discoveryFile` (`:570-572`), which names only `*.controller.ts` and `_defaults.ts` under `serverDir` or `controllersDir` and must also name `*.rpc.ts`, `rpc.ts` and `_app.ts`. A new memo resets in `configResolved` (`:505`), the build-mode `watchChange` (`:507-509`) and every `changed` (`:565`), as `generated` and `discovered` do -->


### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:43-216,414-588` - Contract, importMap, printSchema, entriesCode, declarationOf, the plugin hooks
- `packages/start/src/client.ts:120-136`
- `packages/ui-vite/src/__tests__/server-services.test.ts:264-391,504-695` - the generated-module tests and the discovered-app tests
- `apps/realworld/server/comments-api.server.ts` and `apps/realworld/src/modules/comments/application/contracts.ts` - the shape to reproduce

**Optional**:
- `.flow/memory/bug/integration/virtual-module-needs-a-declaration-and-2026-10-18.md`

## Acceptance
- [ ] a fixture RPC File with `delete`, a typed error class and a referenced Schema generates all four artefacts; the wire id is `<Service>.<method>`
- [ ] a TypeScript consumer typechecks `yield* Comments` against the written declaration
- [ ] the same Tag object is returned by every generated module
- [ ] dev: add, remove, rename and edit regenerate; an invalid file keeps the previous declaration and reports its path
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Done summary
The plugin now turns each `*.rpc.ts` under `serverDir` into a Server Service, end to end. `virtual:sleek/rpc` exports one `Context.GenericTag(<name>)` per RPC File, and `virtual:sleek/server`, `virtual:sleek/server-registry` and `virtual:sleek/server-app` all import their Tags from it, so every module shares one Tag object. The client and registry entries come from the shared `entryCode`. The discovered app's `services` holds `{ entry, layer: serviceLayer(Tag, { methods }, file.wrap), options: [_defaults.ts chain, file] }`, with options that carry `bodyLimit` and `origins` but not `wrap`. `services` is a lazy getter, because `@sleekstack/start` is still evaluating when it imports the module.

The declaration types each Tag as `Context.Tag<Id, GeneratedServiceShape<Pick<typeof import(file), methods>>>`, with methods sorted, and it fills `GeneratedServices`. An app without RPC Files gets a byte-identical declaration: the committed realworld, showcase and docs files did not change.

Dev: adding, removing or renaming an RPC File invalidates all four modules. An edit that keeps the signatures invalidates only the server app. An invalid file fails every load with `file:line` and leaves the previous declaration in place. `sleekstack check` now runs `analyzeRpc` (`rpcErrors`), and RPC Files count as roots.

Tests:
- `packages/ui-vite/src/__tests__/server-services.test.ts`, describe 'RPC Files', with the fixture `fixtures/rpc-files` (`delete`, a typed error class, a referenced Schema, its own `bodyLimit`, and a `_defaults.ts` origin):
  - the four artefacts and one shared Tag
  - the wire ids `Comments.<method>`: the typed failure, a Schema decode 400, the inherited origin, the file's `bodyLimit` (413)
  - the committed declaration, and a TS consumer of `yield* Comments`
  - dev add, edit, rename and remove, and an invalid file
- `packages/cli/src/__tests__/check.test.ts`, 'an app of only RPC Files', with the fixture `fixtures/rpc`.

Notes for task 5: Manifest services (`analyzeRpc` services whose file is not `*.rpc.ts`) are filtered out here. `discoveryFile` already covers `rpc.ts` and `_app.ts`. Fixture graph diff empty.

baseline: green (all Quick commands, pre-edit)
stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
Tier: session (jev-unavailable(no_key)); routing block sets opus at medium
## Evidence
- Commits: b145cea76d2382af195e9df7792e51760145253a
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld --filter=showcase, pnpm --filter realworld check, pnpm turbo run test typecheck build --filter=docs --concurrency=1, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts) # diff empty, pnpm --filter docs test, pnpm --filter docs build, pnpm format:check
- PRs: