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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
