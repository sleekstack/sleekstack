# 0054. Server auto-wiring: files found by extension, RPC Files, the RPC Manifest and Layer Files

## Status

Proposed (draft). Amends ADR 0039 and supersedes ADR 0051's "Nothing is auto-discovered": a file extension or a reserved file name now registers a server part. `serverFn` and `start({ functions })` stay explicit, and so does a hand-written Server Service. Builds on ADR 0053. Spec: fn-69 (depends on fn-68).

## Context

A server entry lists its parts by hand. Realworld's `server/app.ts` imports three implementation Layers and merges them, names `rest` as middleware and passes the generated registry. Each Server Service also takes a contract file, an `implement` call and a `*Live` export. ADR 0051 kept discovery out on purpose, and ADR 0039 kept server functions an explicit list so the analyzer could read them. The analyzer and the Vite plugin now read the program anyway (ADRs 0045, 0050 and 0051), and ADR 0053 makes REST routes files.

## Decision

- **Discovery is the Vite plugin's.** `@sleekstack/ui-vite` finds files by extension or reserved name and serves virtual modules; recognition lives in `@sleekstack/analyze`, and the plugin and `sleekstack check` both call it (ADR 0051). Types go into the existing `serverDeclaration` file and stay types-only (ADR 0045). Auto-wiring needs Vite. A host without it passes explicit options.
- **`start()` takes no arguments.** It reaches the discovered app through `virtual:sleek/server-app`, which also carries the page router built from file routes when no `router` is given (`router` becomes optional). Explicit options still work and merge: arrays concatenate (`services` de-duplicate by Tag identity), Layers merge with `Layer.provideMerge`, and an explicit global scalar is the default beneath the specificity order of ADR 0053. Pages import generated Tags from `virtual:sleek/rpc`. `virtual:sleek/server` (the browser Layer) and `virtual:sleek/server-registry` also carry the generated services, so a browser entry changes nothing.
- **Server-only kinds.** `*.server.ts`, `*.controller.ts`, `*.rpc.ts`, `*.layer.ts`, and `rpc.ts`, `_defaults.ts` and `_app.ts` under `server/`. None may be reachable from a browser entry (`ServerFileInClientGraph`). The analyzer holds this one list.
- **A Layer File is a `*.layer.ts` file whose default export is a Layer.** One Layer per file, found anywhere in the TS program except tests (`__tests__/`, `test/` and `tests/` directories, `*.test.*`, `*.spec.*`). The analyzer composes them by requirement: a Layer's requirement is provided by another Layer File's output. The result also serves the generated implementation Layers and the explicit `layer` option, which wins for any Tag it provides (ADR 0003) and may require what Layer Files provide. A cycle is `LayerFileCycle`. Two Layer Files that provide one Tag are `LayerFileConflict`, naming both. A requirement nobody provides is the existing `MissingDependency`. The Server Root, `server/_app.ts`, holds `onError`.
- **An RPC File is a `*.rpc.ts` file under the server directory (`serverDir`).** Each exported function is a method of one Server Service. A method takes one parameter of any written type, or none, and has a written-out signature, `(input) => Effect<A, E, R>`, with no `any`. `R` may be any service. The analyzer reads it as it reads a Controller Method (ADR 0053), with ADR 0051's subset and Schema references. The Tag is the PascalCase file basename (words split at `-`, `_` and `.`, each first letter capitalised, the rest kept), and `export const service = 'CommentsApi'` overrides it; both must match `[A-Za-z][A-Za-z0-9]*`. The names `wrap`, `bodyLimit`, `origins` and `service` are options, not methods. `wrap` is an `RpcWrap`, type-preserving (`(next: Effect<A, E, R>, request) => Effect<A, E, R2>`), and is applied inside the generated Layer's methods, so wire calls, loaders and `callService` are all wrapped; the Controller directory `wrap` is never inherited, while `bodyLimit` and `origins` are. The build generates the Tag, the registry entry, the implementation Layer and the browser client. The wire is ADR 0039's, with ids `<Service>.<method>` at `POST /_sleek/fn/<id>`. A page calls `yield* Comments`. There is no contract file and no `implement`.
- **The RPC Manifest is `server/rpc.ts`.** Its default export is `rpc({ Service: { method: 'VERB route-name' } }, { wrap?, bodyLimit?, origins? })`. A route name is typed from the generated route table, so renaming a Controller is a type error. A wrapped Controller Method needs a written-out signature, no `any` and no `Response` result (`RpcMethodShape`); an unknown route is `RpcRouteUnknown`. Wrapping never transforms: the RPC method returns the Controller's value as it is, envelope included. A different shape is an RPC File. The input is the Controller's `{ params?, query?, body? }`.
- **The RPC face runs the method, not the Controller's `wrap`.** It decodes the wire input, runs the method, and applies the Manifest's own `wrap`. The directory `wrap` of ADR 0053 reads `Authorization` and turns failures into `Response` values, so on the RPC face a cookie user would be anonymous and the typed errors would be lost. A cookie accepted by a REST route would also skip the RPC wire's origin check, which is a CSRF risk. `ResponseStatus` is ignored on the wire.
- **One namespace for Tag names** across RPC Files, Manifest keys and hand-written `ServerService` ids. A collision is `RpcNameCollision`, naming both.
- **A Schema File is a convention.** A `*.schema.ts` file is client-safe and default-exports a Schema. Nothing is wired from it. A signature may reference any exported Schema value of a client-safe module, and the boundary check protects the browser.
- **Out of scope:** a production server build and adapters, no-JS form posts to Controllers, OpenAPI output, endpoint clients, and streaming results.

## Consequences

- New `AnalyzeCode` values, each with its table row: `RpcMethodShape`, `RpcRouteUnknown`, `RpcNameCollision`, `LayerFileCycle`, `LayerFileConflict` and `ServerFileShape` (a Layer File without a Layer default export, a stray `_app.ts` export, a bad `service` name, a Manifest that is not an object literal of string literals). `ServerFileInClientGraph` covers the new kinds.
- `start()` must reach a virtual module from a package that Vite may externalize. The first task of the spec confirms it. The fallback is that the plugin emits one module that calls `start` and `server/app.ts` re-exports it.
- A Layer File that reads `process.env` at the top level reads it at import, so a test sets the variable before importing the app, as realworld's tests do.
- `serverFn` stays for explicit Schemas and form actions, because a `serverFn` client stub decodes `formData` and a Server Service client does not.
- Hand-written `ServerService` and `implement` (ADRs 0051 and 0052) keep working beside generated services.
- Proof in the spec: realworld moves `rest.ts` to Controllers and its three Server Services to RPC Files, keeping its REST token auth and its cookie session as two surfaces. Showcase's `Tally` becomes a Controller plus the Manifest. Pages change in small ways: `tally.add({ by })` becomes `tally.add({ body: { by } })`.

## Rejected

- **Contract-first only** (a client-safe `.contract.ts` plus an implementation file). It keeps the second file the pitch removes. ADR 0051's contract is still available by hand.
- **Inferred signatures.** The success type would be whatever the body returns, and a row with a hash field would be sent.
- **A Controller that derives a Server Service for every method.** Two faces on every method, with different auth and errors (ADR 0053).
- **A per-directory `rpc.ts`, or an `export const rpc` in each Controller.** Method names cannot be derived from a path and a verb, and the grouping is a cross-file fact that one typed list holds.
- **Path-derived RPC ids.** Moving a file would break the wire id.
- **Auto-attaching a `*.schema.ts` to a Controller by name.** A Schema File cannot type the method body, so the pairing would give wiring with no types.
- **`import.meta.glob` in app code.** It is typed loosely and the analyzer cannot see it.
- **CLI-generated runtime source.** ADR 0045 keeps generation types-only.
- **Collapsing the REST facade and the app's Server Services into one surface.** Their auth and error shapes differ.
