---
satisfies: [R4, R5, R8, R11, R16, R17]
---
# fn-68-file-routed-controllers.6 start: Controller decode, encode, wrap chain and option merging

Touches: [packages/start/src/controller.ts, packages/start/src/wire.ts, packages/start/src/start.ts, packages/start/src/__tests__/**]

## Description
The request-to-response half of a Controller Method: check order, input decode, answer encode, the `wrap` chain, and the merge rules of `start` (R4, R5, R8, R11, R16, R17).

**Size:** M
**Files:** `packages/start/src/controller.ts`, `packages/start/src/wire.ts`, `packages/start/src/start.ts`, `packages/start/src/__tests__/controller-decode.test.ts` (new), `packages/start/src/__tests__/start.test.ts`

### Approach
- Check order for one call: method, path escapes, content type (R17: a declared `body` needs `application/json`, a charset parameter allowed, else `UnsupportedMediaType`), body size (`BodyTooLarge`), JSON parse, then decode of `params`, `query`, `body` with all issues reported; `ParseError` issue paths are relative to the input object; malformed JSON is a `ParseError` with the message `is not valid JSON`; an empty body with `body` declared fails decode. Reuse and export `readBody` and `decodeError` from `wire.ts:43-61,10-22`. The size limit applies only when `body` is declared; validate `bodyLimit` as a positive finite integer when the app loads.
- Encode: a written success Schema encodes the value (fields outside it are dropped); no Schema serializes as is; `void` is 204; `null` is JSON `null`; a `Response` passes through with its own status and body; 204, 205 and 304 send no body and keep the status; `undefined` sends an empty body at any status (R16). Unhandled decode failure answers 400 with the `DecodeError` JSON, a defect answers an empty 500.
- `wrap` chain: compose outer first around (decode, method, encode); `Redirect` and `NotFound` pass through. Option resolution: `bodyLimit` by specificity (file, nearest `_defaults.ts`, `start({ bodyLimit })`, 1 MiB); `origins` only adds to the app-wide allow-list.
- `start` merge (`start.ts:75-88`): arrays concatenate, `services` de-duplicate by Tag identity, a repeated `serverFn` id stays `DuplicateServerFn`, Layers merge with `Layer.provideMerge`, explicit global scalars are the default beneath the specificity order.

### Investigation targets
**Required** (read before coding):
- `packages/start/src/wire.ts:7-113`
- `packages/start/src/start.ts:28-113`
- `packages/start/src/serverFn.ts:79-105` - registry and DuplicateServerFn
- `apps/realworld/server/rest.ts:150-181` - the body-limit and JSON behaviour realworld depends on

**Optional**:
- `packages/start/src/__tests__/start.test.ts`

## Acceptance
- [ ] tests through `fetch` for every status in R16 including 204, 205 and 304 with a value, `undefined`, `null` and `Response` passthrough
- [ ] 415 without `application/json`, 413 by declared length and by stream, 1 MiB minus a margin accepted, malformed JSON and an empty body are decode failures, extra keys ignored
- [ ] decode semantics pinned: repeated query keys, `number` and `boolean` codecs, `[[id]]`, splat string
- [ ] `wrap` composition order and `Redirect`/`NotFound` passthrough tested; `bodyLimit` specificity and `origins` union tested
- [ ] `services` de-duplicate by Tag; a duplicate `serverFn` id still throws
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
