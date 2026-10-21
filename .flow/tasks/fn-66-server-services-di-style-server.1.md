---
satisfies: [R1, R6, R7, R8]
---
# fn-66-server-services-di-style-server.1 start: ServerService, `services` served through the existing endpoint, `taggedError`, `callService`

## Description
The server half of the runtime, driven by a hand-written registry so the DI model is proven before any transformer exists. A ServerService Tag's methods are adapted into the same callable-with-id shape `serverFn` produces, so the registry and the endpoint serve them unchanged (wire untouched, R6).

**Size:** M
**Files:** packages/start/src/service.ts (new), packages/start/src/start.ts, packages/start/src/index.ts, packages/start/src/client.ts (re-export only), packages/testing/src/serverFn.ts or a sibling, packages/start/src/__tests__/service.test.ts (new), packages/start/src/__tests__/service.test-d.ts (new), packages/testing/src/__tests__/
**Touches:** [packages/start/src/**, packages/testing/src/**]

### Approach
- `service.ts` is client-safe: it may import types from `./wire` / `./client` but no server module. It holds `ServerService(id)<Self, Shape>()` (a thin `Context.Tag` wrapper), the registry entry type (`{ tag, methods: { [name]: { input, success, error? } } }`) that task 2 and the generator share, and `taggedError(Class, fields)`.
- The Tag's service type is the contract `Shape` with every method's error widened by `NetworkError | DecodeError`. An implementation Layer typed with the narrow contract errors must stay assignable (error position is covariant); pin both with a `.test-d.ts`.
- `taggedError(Class, fields)`: a Schema for a `Data.TaggedError` subclass. Wire form is `_tag` plus the JSON fields; decode rebuilds the class instance; `Schema.is` is an instance check, because `wire.ts` `run` uses `Schema.is(fn.error)` to pick Failure versus the opaque 500.
- In `start`, flatten `services` into callables with id `<tag id>.<method>`: calling one is `Effect.flatMap(Tag, (svc) => svc[method](input))`, so its `R` is the Tag and the existing `Needs<...>` / `StartLayer` typing makes `layer` require the implementation. Concatenate with `functions` before `registry(...)` so `DuplicateServerFn` / `InvalidServerFnId` cover both.
- `callService(Tag, method, input, { layer })` beside `callServerFn`: reuse `serve` and `envelope`; unknown method names are a type error.

### Investigation targets
**Required** (read before coding):
- `packages/start/src/serverFn.ts:16-30` — the `ServerFn` shape the adapter must satisfy; `:80-96` registry (id grammar, duplicates)
- `packages/start/src/wire.ts:55-72` `run` (error encoding), `:91-117` `endpoint` (check order)
- `packages/start/src/start.ts:46-60` — `StartOptions` and where `functions` becomes the registry
- `packages/testing/src/serverFn.ts:1-60` — `serve`, `envelope`, `callServerFn`

**Optional** (reference as needed):
- `packages/start/src/__tests__/serverFn.test.ts`, `client.test-d.ts` — test shapes to mirror
- `packages/start/package.json` — the `./client` export that must carry `ServerService` and `taggedError`

### Key context
`packages/start/src/client.ts` already imports from `./wire`; `service.ts` must not pull `./start` or any server stage into the browser chunk.

## Acceptance
- [ ] Test: a Tag with a hand-written registry entry and an implementation Layer is served at `POST /_sleek/fn/<Tag>.<method>`: success encoded with the success Schema, a declared error as the Failure envelope, a `Redirect` / `NotFound` from the implementation as on a serverFn, an undeclared failure as the error sink plus an empty 500.
- [ ] Test: input that fails the input Schema is a 400 `DecodeError` and the implementation is never called (spy).
- [ ] Test: a service method id equal to a `serverFn` id fails `start` with `DuplicateServerFn`; a Tag id or method name outside the grammar fails with `InvalidServerFnId`.
- [ ] Type test: `start({ services })` without a Layer providing the Tag is a type error; an implementation Layer with the narrow contract errors is assignable to the Tag; `yield* Tag` methods carry `NetworkError | DecodeError`.
- [ ] Test: `taggedError` round-trips a `Data.TaggedError` subclass into its class (`instanceof` holds) and `Schema.is` rejects a plain object with the same `_tag`.
- [ ] Test: `callService` covers success, declared error, bad input and a defect, mirroring the `callServerFn` cases.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/testing` passes.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
