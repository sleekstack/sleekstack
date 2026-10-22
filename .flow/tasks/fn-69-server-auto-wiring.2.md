---
satisfies: [R3, R4, R5, R7, R9]
---
# fn-69-server-auto-wiring.2 analyze: RPC File and RPC Manifest recognition, naming and client-safety

Touches: [packages/analyze/src/rpc.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/**, packages/cli/llms.md, apps/docs/content/docs/errors.mdx]

## Description
Recognise `*.rpc.ts` and the server directory's `rpc.ts` with the shared reader (R3, R4, R5), enforce the one name namespace (R7) and the client-safety rule (R9).

**Size:** M
**Files:** `packages/analyze/src/rpc.ts` (new), `packages/analyze/src/serverServices.ts`, `packages/analyze/src/errorCodes.ts`, `packages/analyze/src/index.ts`, `packages/cli/llms.md`, `apps/docs/content/docs/errors.mdx`, tests and fixtures

### Approach
- RPC File methods: exported functions with a written signature, accepted forms per the spec's API Contracts (declaration, or arrow/function expression on an exported `const`; destructured inline-typed parameter allowed; generics, `async`, `Effect.fn` rejected); `export { x as delete }` names a method `delete`; non-function exports are not methods; the names `wrap`, `bodyLimit`, `origins`, `service` are options. Tag name: PascalCase of the basename (split at `-`, `_`, `.`; capitalise each word's first letter; keep the rest) must match `[A-Za-z][A-Za-z0-9]*`; `service` must be a string literal of that shape.
- Manifest: the default export must be an object literal of string literals; each `'VERB route-name'` is checked against the Controller routes of the sibling spec (its analyzer path derivation); an unknown route, a verb the Controller does not export or a removed method is `RpcRouteUnknown`; a wrapped method that returns `Response`, has no written signature or uses `any` is `RpcMethodShape`, reported once.
- Namespace: Tag names from RPC Files, Manifest keys, hand-written `ServerService` ids, Layer File output Tag keys and `serverFn` ids must be unique (`RpcNameCollision`, naming both).
- Client-safety: add `*.rpc.ts`, `*.layer.ts` and, under the server directory, `rpc.ts` and `_app.ts` to the shared server-only list; `virtual:sleek/rpc` is a browser-entry marker; a Schema or error class that a generated client imports must live in a client-safe module, not in the RPC File or Controller itself and not behind a server-only import (`ServerFileInClientGraph`).
- Add the three RPC codes (rows, `errors.mdx`, `llms.md` one-line rows).

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:96-174,277-337`
- `packages/analyze/src/typeSchema.ts:35-201`
- the sibling spec's `controllers.ts` (task 4 of fn-68)
- `packages/start/src/serverFn.ts:79-105` - id grammar and DuplicateServerFn

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
