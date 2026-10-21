# 0051. Server Services: DI-style server functions generated from Effect contracts

## Status

Accepted. Amends ADR 0039 (adds a second way to declare server operations; `serverFn`, `client(contract)` and the wire are unchanged). Built in spec fn-66.

## Context

A Server Function (ADR 0039) is declared with an id, three Schemas and a body, listed in `start({ functions })`, and called from the browser through a contract the author keeps in a client-safe module. Three costs:

- The Schemas, the id and the list are written by hand and restate what the body's types already say.
- The browser must never import the body, so the author splits the declaration across files or relies on import pruning.
- A page cannot tell a local call from a remote one; it picks `client(contract)` or the function by environment.

The repo already has the tool for the third cost: Services, Tags and Layers decide what a program gets, and the browser layer lacks server-only services (ADR 0039, D2).

## Decision

- **A Server Service is a Context Tag whose methods are Effect signatures.** `class Profiles extends ServerService('Profiles')<Profiles, { readonly rename: (input: { readonly name: string }) => Effect.Effect<Profile, NameTaken> }>() {}`. `ServerService` comes from `@sleekstack/start/client`, the subpath the browser may import. The file holds only types, `Data.TaggedError` classes and `ServerService` classes, so a client-safe file needs no special extension.
- **The implementation is an ordinary Layer in a `*.server.ts` file**, provided in `start({ layer })`. Its own dependencies are server-only and are not part of the contract. Nothing is auto-discovered.
- **A page calls `yield* Profiles`.** On the server it is the implementation, in-process, with no HTTP hop; in the browser it is a client over the wire. The Tag's type carries `NetworkError | DecodeError`, so one error type serves both environments. Swapping local for remote, or for a test Layer, is a Layer change, like a Record Adapter.
- **A transformer generates the rest.** The `sleekstack()` plugin of `@sleekstack/ui-vite` reads each `ServerService` with the analyzer's TypeScript program and emits two virtual modules: `virtual:sleek/server` (the browser Layer: one client per Tag) and `virtual:sleek/server-registry` (each Tag with its method Schemas, given to `start({ services })`). It adds code and strips none, so there is no import pruning to get wrong.
- **Schemas come from types.** Supported: `string`, `number`, `boolean`, `null`, `undefined`, literals, unions of those, arrays, optional properties, nested object types, `void` for no input, and `Data.TaggedError` classes for errors (the client decodes the class instance back). Anything else is the diagnostic `ServerServiceTypeNotSerializable`, never a guess.
- **Ids** are `<TagId>.<method>`, served at `POST /_sleek/fn/Profiles.rename`. The wire (method, origin, size, JSON and input checks in order; Exit-shaped envelope) is ADR 0039's, unchanged. A collision with a `serverFn` id is `DuplicateServerFn`.
- **The browser boundary is a build error.** A `*.server.ts` reachable from a browser entry fails the client build naming the import chain, and `sleekstack check` reports `ServerFileInClientGraph`. New `AnalyzeCode` values: `ServerServiceFileShape`, `ServerServiceMethodShape`, `ServerServiceTypeNotSerializable`, `ServerFileInClientGraph`, each with its table row.
- **`serverFn` stays.** A type cannot say `NonEmptyString`, a brand or a length, and v1 methods have `R = never`. A function that needs an explicit Schema, or the request services (`Request`, `Cookies`, `ResponseHeaders`), is a `serverFn`.

## Alternatives rejected

- **Strip the body in the client build** (`serverFn` imported directly, `import.meta.env.SSR` guard or a transform). Bundle safety then rests on import pruning and a test, and the server build is transformed too. The Server Service keeps implementations in a file the browser cannot reach.
- **`'use server'`.** A module-level directive drops the whole module, and our stub needs the Schemas. Keeping them means keeping the arguments of `serverFn` and cutting the body, which is the option above. ADR 0039 already rejected copying the directive.
- **`@effect/rpc`.** A second wire and dependency. It does not decode `formData`, and the origin check, body limit and `Redirect` / `NotFound` mapping of ADR 0039 would be redone as RPC middleware.
- **Hand-written Schemas with a generated id and registry.** Keeps validation strong, and is what `serverFn` is. It does not remove the Schemas.

## Consequences

- A Server Service is validated exactly as strictly as its types: `name: string` accepts the empty string. Fields that need constraints use `serverFn`. Two ways to declare a server operation is the price of keeping both guarantees.
- The method signature in the contract is the wire shape. The success type is encoded with the generated Schema, so a wider object returned by the implementation is not sent beyond the declared fields; the contract must write the type out.
- Contract and implementation cannot drift unnoticed: the implementation Layer is checked against the Tag, and the client follows the contract on the next transform.
- The transform needs the TypeScript checker at dev time. It reuses the analyzer's program rather than building another, and an edit to a contract invalidates both virtual modules.
- Request services in a method signature are undecided (parked in the spec). Until then such a method is a `serverFn`.
- The plugin and the analyzer now both read `ServerService` declarations. The recognition lives in the analyzer; the plugin calls it.
