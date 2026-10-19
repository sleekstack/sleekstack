---
satisfies: [R6, R9]
---
# fn-54-start-server-core-for-sleekstackui.4 start: typed client stubs that plug into form actions, useAction and router actions

## Description
Add the browser side as a separate entry of the package: `client<typeof import(...)>()` returns stubs that are Effects typed from the server module's declarations, failing with the declared error, `NetworkError` or `DecodeError`. A redirect or not-found envelope fails with the router's `Redirect` / `NotFound`.

**Size:** M
**Files:** new packages/start/src/client.ts, packages/start/src/__tests__/client.test.ts, client.test-d.ts; package.json `exports` for the client entry
**Touches:** [packages/start/src/client.ts, packages/start/package.json, packages/start/src/__tests__/**]

### Approach
- Stubs derive their input, success and error types from the `serverFn` declarations through the type-only import; the client entry imports no server module, no `Layer` graph and nothing from the server entry.
- Open design point to settle first and record for the ADR task: decoding the response at runtime needs the Schemas in the browser, which a purely type-only import cannot supply. Prefer splitting a declaration into a client-safe contract (id and Schemas) and a server body, so the client imports the contract and never the body; if the split proves heavy, fall back to types-only and drop the client-side `DecodeError` for the success value (then say so in the ADR and amend R6 through the spec's review path).
- Verify the stub works unchanged as a form `action` (with a Schema-decoded `FormData`), with `useAction`, and as a router `action`.

### Investigation targets
**Required**:
- `packages/ui/src/reactive.ts` (`useAction`, `BoundAction`)
- `packages/ui/src/jsx-types.ts` (`FormAction`)
- `packages/router/src/action.ts`, `resolve.ts` (control flow on the client)
- `packages/router/src/history.ts` (how `startRouter` handles an action's `Redirect`)
**Optional**:
- `docs/adr/0033-*.md`

## Acceptance
- [ ] Type tests: stub input, success and error types follow the server declaration; a wrong input type fails to compile
- [ ] A network failure is `NetworkError`; a body failing its Schema is `DecodeError`; a Redirect envelope fails with the router's `Redirect`
- [ ] A test runs the stub as a form `action`, through `useAction`, and as a router `action`, with no adapter code
- [ ] The client entry's module graph contains no server module (checked in the showcase bundle test of the next task)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` is green

## Done summary
`@sleekstack/start/client` exports `client(contract)`, `Contract`, `Stub`, `NetworkError` and `DecodeError`. A stub is an Effect-returning function. It Schema-encodes its input, POSTs it to `/_sleek/fn/<id>` and decodes the envelope with task 3's `decodeResult`. It fails with:
- the declared error
- the router's own `Redirect` / `NotFound`
- `NetworkError`: `fetch` rejected, or a non-2xx with no JSON envelope (carries `status`)
- `DecodeError`: input or FormData failing the input Schema (raised before any request), a body failing its Schema, an unknown envelope, or a 2xx that is not JSON

Given an `ActionEvent`, the stub decodes `formData` with the input Schema, so it works as a form `action`, `useAction(stub)` and router `action(stub)` with no adapter. Tests: `packages/start/src/__tests__/client.test.ts` (runtime, jsdom), `client.test-d.ts` (types, `FormAction` assignability, wrong input fails to compile).

Design point settled (for the ADR, task 6): the client-safe contract split, with no change to `serverFn`. A contract is a plain `{ id, input, success, error? }` object in a module the browser may import. The server builds its function from it with `serverFn(contract.id, contract)(function* ...)`, so stub and server types come from the same Schemas, and the client imports Schemas, never the server body. R6 ("typed from the server module with a type-only import") reads more precisely as "typed from the contract the server function is built from". `client(serverFnItself)` also type-checks (used in the type test), but browser code must pass the contract. R6 still has client-side `DecodeError`, so no amendment is needed beyond that wording.

Module graph: `client.ts` imports `wire.ts` (which imports `origin.ts` and type-only `serverFn`), `@sleekstack/router`, `effect` and a type from `@sleekstack/ui`. It imports nothing from `start.ts`, `services.ts` or any Layer. `wire.ts` also holds the server `endpoint`, which is tree-shaken (`sideEffects: false`). Task 5's bundle test should confirm this.

Notes:
- A repeated form field keeps its last value (`Object.fromEntries`), marked `ponytail:` in `client.ts`.
- `client.ts` repeats wire.ts's 4-line ParseError-to-issues mapping, because wire.ts was outside Touches. Follow-up: export it from wire.ts.
- `packages/start` gains devDeps jsdom, react, react-dom and @types/react for the DOM tests (lockfile updated, no sleek-codes entries).
- The first commit's `git add -A` swept conductor-written `.flow/tasks/...6.json` and `.8.{json,md}` into 0e73f35.

baseline: green (`pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=showcase`)
stage: impl-review - ran (codex fan-out, all 3 draws NEEDS_WORK on one P1: the stub needed an ActionEvent adapter; fixed in b1a7482; codex re-review SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: 0e73f355cf5904f3d517ba72db328e8b76b0b628, b61a0dcdce3180534ee8e1d6cb6ab56a36251a03, b1a7482456c6d8ad65951fc1f9ce7cd02f3f4aa6
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=showcase
- PRs: