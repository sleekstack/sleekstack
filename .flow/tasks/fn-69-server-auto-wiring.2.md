---
satisfies: [R3, R4, R5, R7, R9]
---
# fn-69-server-auto-wiring.2 analyze: RPC File and RPC Manifest recognition, naming and client-safety

Touches: [packages/analyze/src/rpc.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/**, packages/cli/llms.md, apps/docs/content/docs/errors.mdx, packages/analyze/src/controllers.ts, packages/analyze/src/typeSchema.ts]

## Description
Recognise `*.rpc.ts` and the server directory's `rpc.ts` with the shared reader (R3, R4, R5), enforce the one name namespace (R7) and the client-safety rule (R9).

**Size:** M
**Files:** `packages/analyze/src/rpc.ts` (new), `packages/analyze/src/serverServices.ts`, `packages/analyze/src/errorCodes.ts`, `packages/analyze/src/index.ts`, `packages/cli/llms.md`, `apps/docs/content/docs/errors.mdx`, tests and fixtures

### Approach
- RPC File methods: exported functions with a written signature, accepted forms per the spec's API Contracts (declaration, or arrow/function expression on an exported `const`; destructured inline-typed parameter allowed; generics, `async`, `Effect.fn` rejected); `export { x as delete }` names a method `delete`; non-function exports are not methods; the names `wrap`, `bodyLimit`, `origins`, `service` are options. Tag name: PascalCase of the basename (split at `-`, `_`, `.`; capitalise each word's first letter; keep the rest) must match `[A-Za-z][A-Za-z0-9]*`; `service` must be a string literal of that shape. <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 built the reader as `readSignature(ctx, sig, accept)` in `serverServices.ts:95-144` (`ctx` is `{ program, checker, root, serverDir }`; it is not exported from `index.ts`). Use `{ requires: 'any' }`: it keeps a written return and reads the tagged errors of `E`, which the Controller pass relaxes with `returns: 'optional'` and `errors: 'any'`. A refusal is `Unreadable` (map it to `RpcMethodShape`) or `NotSerializable` (`ServerServiceTypeNotSerializable`). Its return check reads `ret.aliasSymbol` (`:128`), so a return written through a same-file alias (`type Answer = Effect.Effect<...>`) is refused as `does not return an Effect.Effect<A, E>` (fn-68-file-routed-controllers.11): fixtures write `Effect.Effect<...>` inline or alias only the success object, which the Schema reader unaliases -->
- Manifest: the default export must be an object literal of string literals; each `'VERB route-name'` is checked against the Controller routes of the sibling spec (its analyzer path derivation); an unknown route, a verb the Controller does not export or a removed method is `RpcRouteUnknown`; a wrapped method that returns `Response`, has no written signature or uses `any` is `RpcMethodShape`, reported once. <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 and .8. The Controller routes come from `controllerRoute(controllersDir, file)` (`controllers.ts:52-79`, exported from `@sleekstack/analyze`: `{ route, pattern }`) and `analyzeControllers({ project, serverDir?, controllersDir? })` (`controllers.ts:111`), whose `ControllerDecl` is `{ route, pattern, file, methods }`. `methods` holds only the methods read without error, so a method with its own `ControllerMethodShape` is absent: do not also report it as `RpcRouteUnknown`. Each method is `{ name, location, requires, schema: { input, success } }`, and that schema is the HTTP face's, so it does not fit a wrapped method: the `number` and `boolean` leaves of `params` and `query` carry `codec: 'string'` (the RPC input is the plain-number variant), `success` is undefined without a written return type (here `RpcMethodShape`), and `E` is never read (`errors: 'any'`) while the RPC face needs the tagged errors. The Manifest pass reads the method's signature again with the RPC options, or `analyzeControllers` exposes the unmarked input and the errors; either edits `controllers.ts` (`methodOf` `:288-351`, `signatureOf` `:280-286`), outside this task's Touches -->

- Namespace: Tag names from RPC Files, Manifest keys, hand-written `ServerService` ids, Layer File output Tag keys and `serverFn` ids must be unique (`RpcNameCollision`, naming both). <!-- Updated by plan-sync: fn-69-server-auto-wiring.1 returns the Layer File Tag names from `analyzeLayerFiles({ project, serverDir? })` (exported from `index.ts`): `layerFiles[].provides` are Tag names (strings), `layerFiles[].file` is relative to the tsconfig directory -->
- Client-safety: add `*.rpc.ts`, `*.layer.ts` and, under the server directory, `rpc.ts` and `_app.ts` to the shared server-only list; `virtual:sleek/rpc` is a browser-entry marker; a Schema or error class that a generated client imports must live in a client-safe module, not in the RPC File or Controller itself and not behind a server-only import (`ServerFileInClientGraph`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 and .3. The list is one analyzer export: `SERVER_ONLY` is `{ kinds: ['server', 'controller'], reserved: ['_defaults'] }` with `isServerOnly(file, serverDir)` (`serverServices.ts:30-47`; a reserved name matches under the server directory at any depth). `sleekstack check`, the plugin's load guard and the bundled `analyze()` plugin all read it, so the kinds `rpc` and `layer` and the reserved names `rpc` and `_app` reach all three from that one edit. The only browser-entry marker is `CLIENT_MODULE = 'virtual:sleek/server'` (`serverServices.ts:28`, tested at `:441`). The reader already refuses a Schema reference into a server-only module (`typeSchema.ts:198`, as `Unreadable`), which covers an RPC File or Controller once the kinds are listed. A tagged error class is not covered: `errorOf` (`typeSchema.ts:319-338`) never calls `ctx.serverOnly`, so an error class declared in an RPC File, a Controller or another server-only module is not reported until `typeSchema.ts` (outside Touches) checks the class's file. The reader reports a refused reference as `Unreadable`, which a caller turns into its own shape code, while R9 names `ServerFileInClientGraph`: choose the code on purpose and test it. The `ServerFileInClientGraph` rule row and its `errors.mdx` row list the kinds (reworded by fn-68-file-routed-controllers.4) and need the new ones -->
- Add the three RPC codes (rows, `errors.mdx`, `llms.md` one-line rows). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4: `llms.md` is 5911 of 8192 bytes, and `errors.mdx` has a Controller errors section (anchor `/docs/errors#controller-errors`, constant `CONTROLLER` in `errorCodes.ts`) to copy for the RPC section -->  <!-- Updated by plan-sync: fn-69-server-auto-wiring.1 added `LayerFileCycle`, `LayerFileConflict` and `ServerFileShape` (union `errorCodes.ts:11-37`, table `:54-214`) with a `FILES` constant (`/docs/errors#server-file-errors`) and an errors.mdx section; `llms.md` is now 6191 of 8192 bytes, so the three RPC rows still fit -->

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:30-47,95-144,424-457` - SERVER_ONLY, readSignature, the client-graph walk
- `packages/analyze/src/typeSchema.ts:104-360` - methodSchema, the Schema reference reader (`:182-209`), the error reader (`:319-338`)
- `packages/analyze/src/controllers.ts:52-79,111,280-351` - controllerRoute, analyzeControllers, the Controller reader (task 4 of fn-68)
- `packages/start/src/serverFn.ts:79-105` - id grammar and DuplicateServerFn
- `.flow/memory/bug/integration/syntactic-schema-reference-reading-must-2026-10-22.md` - an unusual form is a diagnostic, never a silent structural type

**Optional**:
- `apps/realworld/src/modules/*/application/contracts.ts` - real method shapes (`delete`)

## Acceptance
- [ ] fixtures: each accepted form and each rejected form, `export { remove as delete }`, a non-function export, an option name used as a method, a non-literal `service`, a derived name outside the grammar, an R that names another generated Tag
- [ ] Manifest fixtures: unknown route, missing verb, removed method (reported once), `Response` return, non-literal object
- [ ] collisions across all five namespaces name both sources
- [ ] an error class declared inside an RPC File and one imported from a server-only module are reported
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
