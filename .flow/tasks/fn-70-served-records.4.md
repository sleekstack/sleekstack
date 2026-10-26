---
satisfies: [R6]
---
# fn-70-served-records.4 start: the HTTP adapter Layer for a served record

Touches: [packages/start/src/recordsClient.ts, packages/start/src/client.ts, packages/start/src/index.ts, packages/start/src/__tests__/**, packages/start/package.json, pnpm-lock.yaml]

## Description
The browser half: a function the generated code calls to build the Layer that provides a record's adapter Tag over HTTP.

**Size:** S
**Files:** `packages/start/src/recordsClient.ts` (new), `packages/start/src/client.ts` (only if the base-URL or fetch handling must be shared), `packages/start/src/index.ts`, `packages/start/src/__tests__/recordsClient.test.ts` (new)

### Approach
- Drift from task 3: `@sleekstack/start` has no dependency on `@sleekstack/model`, and `records.ts` matched `RecordNotFound`/`RecordRejected` by `_tag` and the record by shape. This task needs the real error classes, so add the workspace dependency to `packages/start/package.json` (and the lockfile), then switch the `_tag` checks in `records.ts` to `instanceof` if it stays simple. Keep a one-line note if you leave it.
- `recordAdapterLayer(record, pattern)` returns `Layer.succeed(record.adapter, { find, save })`; `pattern` is the route in `/articles/:id` syntax (as `ControllerEntry.pattern`, `app.ts:75`), with the id percent-encoded into it.
- Reuse how the Server Service browser client reaches the server (`serverClients`, `packages/start/src/client.ts:120-136`): the same `fetch` and base-URL source, so SSR-less tests and a custom `fetch` behave identically. Do not add a second configuration surface.
- Failure mapping exactly as the spec's API Contracts: 404 to `RecordNotFound`, 400 and 422 to `RecordRejected` (`message` from the body, else the status text), everything else `Effect.die`. The success body must be a JSON object, else a defect.
- This file imports only client-safe modules (it is bundled into the browser).

### Investigation targets
**Required**:
- `packages/start/src/client.ts` - fetch, base URL, error handling of the existing client
- `packages/model/src/adapter.ts:29-35` - the contract to implement

### Acceptance
- [ ] `find` and `save` call `GET` and `PATCH` of the pattern with the id filled in, a JSON body and `Content-Type: application/json` (fake `fetch` test)
- [ ] 404, 400, 422 give the typed failures; 401, 500, a rejected `fetch` and an array body each die
- [ ] An id containing `/` or `%` is encoded into one path segment
- [ ] The module graph of this file has no server-only import (existing boundary test or a new one)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` passes

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
