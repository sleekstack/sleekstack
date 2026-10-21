## Goal & Context
<!-- scope: business -->

A Server Function (ADR 0039) needs a hand-written id, hand-written Schemas, a place in `start({ functions })`, and a client built from a contract the author keeps in step with the server body. Server code reaches the browser unless the author keeps the body in a different module from the contract.

Goal: a **Server Service**. The author declares a Context Tag whose methods are Effect signatures, in a file the browser may import. The implementation is an ordinary Layer in a `*.server.ts` file. A build-time transformer reads the types and generates the browser client and the server registry. Pages call `yield* Profiles` and neither know nor care whether the call runs in-process (server) or over the wire (browser). Local versus remote is a Layer choice, like a Record Adapter.

No hand-written Schemas, ids, `functions` list or client stub. The browser can never import an implementation: the build fails with the import chain.

Not a replacement for `serverFn`: `serverFn` stays for the cases a type cannot express (refinements, request services, one-off form actions). See ADR 0051.

## Architecture & Data Models
<!-- scope: technical -->

- **Contract** (client-safe, any file): `class Profiles extends ServerService('Profiles')<Profiles, { readonly rename: (input: { readonly name: string }) => Effect.Effect<Profile, NameTaken>; ... }>() {}`. `ServerService` is exported from `@sleekstack/start/client` (the subpath the browser may import; the root export pulls server code). It is a thin wrapper over `Context.Tag` that the transformer and analyzer recognize. The file may hold only types, `Data.TaggedError` classes and `ServerService` classes.
- **Implementation** (server only, `*.server.ts`): `Layer.effect(Profiles, ...)` or `Layer.succeed`. Its own dependencies (a `Db` Layer, other `*.server.ts` services) are server-only and not part of the contract. Provided in `start({ layer })` like any Layer; nothing is auto-discovered.
- **Transformer** (in the `sleekstack()` plugin of `@sleekstack/ui-vite`): reads each `ServerService` class with the TypeScript checker (the analyzer's program, so dev HMR does not build a second one) and generates two virtual modules:
  - `virtual:sleek/server`: a Layer providing every ServerService Tag as a client. A method call encodes the input with the generated Schema, `POST`s it, and decodes the Exit-shaped envelope (ADR 0039 wire, unchanged).
  - `virtual:sleek/server-registry`: each Tag with its method Schemas, given to `start({ services })`. The handler resolves the Tag from the Request Scope and calls the method.
- **Type to Schema** (the supported subset): `string`, `number`, `boolean`, `null`, `undefined`, string/number/boolean literals, unions of those, `readonly`/mutable arrays, optional properties, nested object types, `void` for an absent input or `undefined` result, and `Data.TaggedError` classes for errors (`_tag` plus JSON-shaped fields; the client decodes the class instance back). Everything else is a diagnostic, not a guess.
- **Ids**: `<TagId>.<method>`, e.g. `Profiles.rename`, served at `POST /_sleek/fn/Profiles.rename`. The Tag id and method names must match the id grammar of ADR 0039 (`[A-Za-z0-9][A-Za-z0-9_.-]*`); a collision with a `serverFn` id fails `start` with `DuplicateServerFn`.
- **Boundary**: a `*.server.ts` file reachable from a browser entry fails the client build naming the import chain, and the analyzer reports `ServerFileInClientGraph`. The transformer only adds code and strips none, so there is no import pruning to get wrong.

## API Contracts
<!-- scope: technical -->

- `ServerService(id)<Self, Shape>()` in `@sleekstack/start/client`. `Shape` is a record of methods `(input?: In) => Effect.Effect<Out, Err>`; `R` is `never`.
- `start({ ..., services })` in `@sleekstack/start`: the generated registry. The server layer must provide every registered Tag (existing layer check reports a missing one).
- Generated: `virtual:sleek/server` (default export: Layer) and `virtual:sleek/server-registry` (default export: registry). Declared in a `*.d.ts` the plugin writes, as `routes.gen.d.ts` is (ADR 0050).
- Client call error: a browser-side method call can also fail with `NetworkError | DecodeError` (`@sleekstack/start/client`). The Tag's type carries them so a page handles one error type in both environments.
- `@sleekstack/testing`: `callService(entry, method, input, { layer })` (the registry entry carries the Tag and its Schemas) resolves to an `Exit` through `start(...).fetch` (the wire path); plain DI (`Effect.provide(Layer.succeed(Profiles, ...))`) needs nothing.

## Edge Cases & Constraints
<!-- scope: technical -->

- Methods take at most one input parameter (an object or a single value). Zero parameters mean `Schema.Void`.
- Contract methods have `R = never`. A method that needs request services (`Request`, `Cookies`, `ResponseHeaders`) stays a `serverFn` until the parked decision below is made.
- Type-derived Schemas are exactly as strict as the types: `name: string` accepts the empty string. Constraints that matter at the trust boundary use `serverFn` with an explicit Schema.
- The success type is the wire shape: the generated success Schema encodes only the declared fields, so a row with extra columns is not leaked when the method's return type is the narrow type. An inferred wider type is not an error the checker can see; the method signature in the contract is the shape, and the analyzer requires it to be written out.
- No streaming results (as ADR 0039).
- Impl and contract drift: the implementation Layer is type-checked against the Tag, so a method changed in the contract fails the server compile, and the generated client follows the contract on the next transform.
- A `ServerService` class exported from several files, a Tag declared dynamically, or a contract that re-exports through a barrel the checker cannot follow: reported with its file, not skipped.
- HMR: editing a contract invalidates both virtual modules; editing an implementation does not touch the client graph.
- SSR: on the server, `yield* Profiles` is the implementation. SSR never calls its own HTTP endpoint.

## Quick commands

```bash
pnpm turbo run test typecheck --filter=@sleekstack/start --filter=@sleekstack/testing --filter=@sleekstack/analyze --filter=@sleekstack/ui-vite
pnpm turbo run test typecheck --filter=showcase
```

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A `ServerService` in a client-safe file, implemented in `*.server.ts`, is callable from a page as `yield* Profiles` in the browser (over the wire) and on the server (in-process), with the same method signature plus `NetworkError | DecodeError` on the client. Errors: a declared error arrives typed (its class instance); an undeclared failure or defect is the error sink and an empty 500; a `Redirect` or `NotFound` from the implementation reaches the caller as on a Server Function; a Tag with no implementation in the server layer fails `start` or the check, not a call.
- **R2:** The browser client and the server registry are generated from the contract types: no hand-written Schema, id, `functions` entry or client stub exists in the showcase's new example. Errors: a contract that cannot be read (a Tag the checker cannot resolve, a method whose types are `any`) fails the build with its file and line, never a silent empty client.
- **R3:** Every supported type in the Type to Schema subset round-trips through the wire in a test (input encode, output decode, a declared `Data.TaggedError` decoded back into its class). Every unsupported type yields `ServerServiceTypeNotSerializable` with file and line. Errors: input that does not match the generated input Schema is a 400 `DecodeError` before the implementation runs; a response that does not match the generated success Schema is a `DecodeError` on the client.
- **R4:** A `*.server.ts` reachable from the browser graph fails the client build naming the import chain, and fails `sleekstack check` as `ServerFileInClientGraph`. A showcase bundle test proves the client chunk holds no `*.server.ts` and no server Layer. Errors: a `*.server.ts` imported only from other server code or from tests is not an error; a type-only import of a `*.server.ts` from client code is erased and is not an error.
- **R5:** `ServerServiceFileShape`, `ServerServiceMethodShape`, `ServerServiceTypeNotSerializable` and `ServerFileInClientGraph` are `AnalyzeCode` values, each with its table row (rule, fix, docs) and an errors-page entry. Errors: a `ServerService` class in a `*.server.ts` file is `ServerServiceFileShape`; a method with more than one parameter, a non-Effect return, a non-`never` `R`, or a missing explicit type is `ServerServiceMethodShape`.
- **R6:** The wire is ADR 0039's, unchanged: same checks in the same order, same Exit-shaped envelope, same origin check and body limit, per method id. Existing `serverFn` behavior and tests are unchanged. Errors: no error surface beyond ADR 0039's (405, 403, 404, 413, 400, empty 500).
- **R7:** A server layer missing a registered Tag fails `sleekstack check`; a duplicate id between a ServerService method and a `serverFn` fails `start` with `DuplicateServerFn`. Errors: an id outside the ADR 0039 grammar (a Tag id or method name) fails `start` with `InvalidServerFnId`; two ServerService classes with one Tag id fail the build naming both files.
- **R8:** Swapping the implementation Layer for a test Layer needs no transformer and no network, and `callService` exercises the wire path. Errors: `callService` resolves to an `Exit` like `callServerFn` (declared error, `Redirect`, `NotFound`, `DecodeError`, or the cause the error sink received); an unknown method name is a type error.
- **R9:** CONTEXT.md has a Server Service entry, ADR 0051 is in the index, and `apps/docs` has a guide page whose example type-checks (`pnpm turbo run test typecheck build --filter=docs`). No error surface beyond the docs build failing on a broken example or link.

## Early proof point

Task fn-66-server-services-di-style-server.1 validates the core approach: a ServerService method served through the existing registry and endpoint (`yield* Tag` in-process on the server, over the unchanged wire from a hand-written registry), with the Tag's type widened for the browser. If it fails, re-evaluate the DI contract shape before the analyzer and transformer tasks (.3 onward).

## Boundaries
<!-- scope: business -->

- Not removing `serverFn`, `client(contract)` or the `functions` registry.
- Not `@effect/rpc`, and no new runtime dependency.
- Not auto-discovering implementations: the server layer stays explicit.
- Not request services in method signatures, streaming results, or hand-written Schema overrides on a Server Service.
- Not a general TS-type-to-Schema generator: the listed subset, and a diagnostic for the rest.
- Not a `'use server'` directive or any transform that strips code.

## Decision Context
<!-- scope: both -->

Alternatives weighed and rejected (full reasoning in ADR 0051):

- **Strip the body in the client build** (`serverFn` imported directly): works, but bundle safety rests on import pruning and a test, and the server build is transformed too.
- **`'use server'`**: our stub needs the Schemas, which a module-level directive drops; ADR 0039 already rejected copying it.
- **`@effect/rpc`**: a second wire and dependency, no form-action decoding, and our origin, body-limit and Redirect/NotFound mapping would be redone as middleware.
- **Hand-written Schemas with a generated id and registry**: smaller, and keeps validation strong, but keeps the Schemas the goal wants gone. It remains the `serverFn` path.

Parked unknowns:

- Request services (`Request`, `Cookies`, `ResponseHeaders`) in a ServerService method. Option: allow `R` as a subset of the request services in the contract, provided per call on the server and absent in the browser Layer (so a page needing them in the browser fails the layer check). Needs its own decision once an auth example exists.
- A Schema override for one field (a refinement) without leaving the type-derived path.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | A `ServerService` in a client-safe file, implemented in `*.server.ts`, is callable from a page as `yield* Profiles` in the browser (over the wire) and on the server (in-process), with the same method signature plus `NetworkError \| DecodeError` on the client. Errors: a declared error arrives typed (its class instance); an undeclared failure or defect is the error sink and an empty 500; a `Redirect` or `NotFound` from the implementation reaches the caller as on a Server Function; a Tag with no implementation in the server layer fails `start` or the check, not a call. | fn-66-server-services-di-style-server.1, fn-66-server-services-di-style-server.2, fn-66-server-services-di-style-server.7 | — |
| R2 | The browser client and the server registry are generated from the contract types: no hand-written Schema, id, `functions` entry or client stub exists in the showcase's new example. Errors: a contract that cannot be read (a Tag the checker cannot resolve, a method whose types are `any`) fails the build with its file and line, never a silent empty client. | fn-66-server-services-di-style-server.5, fn-66-server-services-di-style-server.7 | — |
| R3 | Every supported type in the Type to Schema subset round-trips through the wire in a test (input encode, output decode, a declared `Data.TaggedError` decoded back into its class). Every unsupported type yields `ServerServiceTypeNotSerializable` with file and line. Errors: input that does not match the generated input Schema is a 400 `DecodeError` before the implementation runs; a response that does not match the generated success Schema is a `DecodeError` on the client. | fn-66-server-services-di-style-server.2, fn-66-server-services-di-style-server.4, fn-66-server-services-di-style-server.5 | — |
| R4 | A `*.server.ts` reachable from the browser graph fails the client build naming the import chain, and fails `sleekstack check` as `ServerFileInClientGraph`. A showcase bundle test proves the client chunk holds no `*.server.ts` and no server Layer. Errors: a `*.server.ts` imported only from other server code or from tests is not an error; a type-only import of a `*.server.ts` from client code is erased and is not an error. | fn-66-server-services-di-style-server.6, fn-66-server-services-di-style-server.7 | — |
| R5 | `ServerServiceFileShape`, `ServerServiceMethodShape`, `ServerServiceTypeNotSerializable` and `ServerFileInClientGraph` are `AnalyzeCode` values, each with its table row (rule, fix, docs) and an errors-page entry. Errors: a `ServerService` class in a `*.server.ts` file is `ServerServiceFileShape`; a method with more than one parameter, a non-Effect return, a non-`never` `R`, or a missing explicit type is `ServerServiceMethodShape`. | fn-66-server-services-di-style-server.3, fn-66-server-services-di-style-server.4, fn-66-server-services-di-style-server.6 | — |
| R6 | The wire is ADR 0039's, unchanged: same checks in the same order, same Exit-shaped envelope, same origin check and body limit, per method id. Existing `serverFn` behavior and tests are unchanged. Errors: no error surface beyond ADR 0039's (405, 403, 404, 413, 400, empty 500). | fn-66-server-services-di-style-server.1, fn-66-server-services-di-style-server.2 | — |
| R7 | A server layer missing a registered Tag fails `sleekstack check`; a duplicate id between a ServerService method and a `serverFn` fails `start` with `DuplicateServerFn`. Errors: an id outside the ADR 0039 grammar (a Tag id or method name) fails `start` with `InvalidServerFnId`; two ServerService classes with one Tag id fail the build naming both files. | fn-66-server-services-di-style-server.1, fn-66-server-services-di-style-server.3 | — |
| R8 | Swapping the implementation Layer for a test Layer needs no transformer and no network, and `callService` exercises the wire path. Errors: `callService` resolves to an `Exit` like `callServerFn` (declared error, `Redirect`, `NotFound`, `DecodeError`, or the cause the error sink received); an unknown method name is a type error. | fn-66-server-services-di-style-server.1, fn-66-server-services-di-style-server.7 | — |
| R9 | CONTEXT.md has a Server Service entry, ADR 0051 is in the index, and `apps/docs` has a guide page whose example type-checks (`pnpm turbo run test typecheck build --filter=docs`). No error surface beyond the docs build failing on a broken example or link. | fn-66-server-services-di-style-server.7 | — |


