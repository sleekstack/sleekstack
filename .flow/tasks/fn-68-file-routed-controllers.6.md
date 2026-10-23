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
- Check order for one call: method, path escapes, content type (R17: a declared `body` needs `application/json`, a charset parameter allowed, else `UnsupportedMediaType`), body size (`BodyTooLarge`), JSON parse, then decode of `params`, `query`, `body` with all issues reported; `ParseError` issue paths are relative to the input object; malformed JSON is a `ParseError` with the message `is not valid JSON`; an empty body with `body` declared fails decode. Reuse and export `readBody` and `decodeError` from `wire.ts:43-61,10-22`. The size limit applies only when `body` is declared; validate `bodyLimit` as a positive finite integer when the app loads (`ControllerOptions.file` names the file). <!-- Updated by plan-sync: fn-68-file-routed-controllers.5 built the first two checks and the unhandled mappings: the `face` of `serveController` (`packages/start/src/controller.ts`) runs the method check, then the path-escape check (`InvalidPathEncoding`), inside the `wrap` chain, then `run.run({ params })` with raw decoded strings. This task inserts content type, size, JSON parse and decode between the escape check and `run`. `UnsupportedMediaType` and `BodyTooLarge` are already exported classes (`@sleekstack/start`) and `unhandled` in `controller.ts` already answers 415 and 413 when `wrap` leaves them alone; nothing raises them yet, and the unhandled 400 `DecodeError` answer is the one mapping still to add there (`DecodeError` and the private `decodeError` are in `wire.ts`) -->
- Encode: a written success Schema encodes the value (fields outside it are dropped); no Schema serializes as is; `void` is 204; `null` is JSON `null`; a `Response` passes through with its own status and body; 204, 205 and 304 send no body and keep the status; `undefined` sends an empty body at any status (R16). Unhandled decode failure answers 400 with the `DecodeError` JSON, a defect answers an empty 500. <!-- Updated by plan-sync: fn-68-file-routed-controllers.5 left an interim encoding in the `face` to replace: a returned `Response` passes through and any other value is `Response.json(value, { status: status() ?? 200 })`, where `status` is `requestServices(request).status` handed in by `start`; a `void` method throws inside `Response.json` until this task adds R16. The `ResponseStatus` TSDoc promises a default of 200, or 204 for `void`, and says a `Response` answer and a `wrap`-mapped failure ignore the status set -->
- `wrap` chain: compose outer first around (decode, method, encode); `Redirect` and `NotFound` pass through. Option resolution: `bodyLimit` by specificity (file, nearest `_defaults.ts`, `start({ bodyLimit })`, 1 MiB); `origins` only adds to the app-wide allow-list. <!-- Updated by plan-sync: fn-68-file-routed-controllers.5 composed the chain already (`entry.options.reduceRight` over the `face`, so `options[0]` is outermost; `ControllerOptions.wrap` is typed `Wrap`) and `Redirect` and `NotFound` already leave `unhandled` as failures, which `fetch` answers 302 and 404; this task widens the `face` and adds the order and passthrough tests -->
- `start` merge (`start.ts:97-124`): arrays concatenate, `services` de-duplicate by Tag identity, a repeated `serverFn` id stays `DuplicateServerFn`, Layers merge with `Layer.provideMerge`, explicit global scalars are the default beneath the specificity order.
- The discovered app is only known after the first request awaits `discover()` (`start.ts:123`), not at the `start()` call. The `endpoint(...)` (`start.ts:100-106`: allow-list and server-function `bodyLimit`) is built at the call today, so build it, and the Controller matcher, after discovery and memoize them, or the `origins` and `bodyLimit` exports of discovered files never reach it. Keep "no explicit options" as `Object.keys(options).length === 0` (`start({})` counts as none). `DiscoveredApp` carries only `controllers` and `router?`, so there are no discovered Layers or services to merge in this spec, and `configureRuntime` stays at the `start()` call. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 made discovery lazy (first request) and moved the start.ts references --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.5 shipped `StartOptions.controllers` and memoizes the merged list once after discovery (`discovered ??= discover(explicit).then(...)`, discovered entries first, `options.controllers` after, `start.ts:126-129`); `fetch` matches with `matchController(app.controllers, pathname)` (`start.ts:138`). Still to move into that memoized promise: `endpoint(...)`, which is still built at the `start()` call (`start.ts:103-109`), with the discovered `origins` and `bodyLimit` folded in -->

### Investigation targets
**Required** (read before coding):
- `packages/start/src/controller.ts` - `serveController`'s `face`, `unhandled`, `matchController` (task 5)
- `packages/start/src/wire.ts:7-113`
- `packages/start/src/start.ts:28-143`
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
The Controller HTTP face now decodes and encodes, and `start` merges its options with the discovered app (R4, R5, R8, R11, R16, R17).

- `serveController` (`packages/start/src/controller.ts`) runs, inside the `wrap` chain and after the method and escape checks: content type (`application/json`, any parameter, case-insensitive, else `UnsupportedMediaType`), body size within the most specific `bodyLimit` (`BodyTooLarge`), JSON (`ParseError` at `body` with `is not valid JSON`), then one `Schema.Struct` of the declared parts, decoded with `errors: 'all'`, so issue paths start at `params`, `query` or `body`.
  - Only declared parts reach the method. An empty body is absent, so a required `body` fails decode with `is missing`.
  - A query key collects all its values when the encoded Schema type is an array (read from `SchemaAST.encodedAST`). Any other key takes the last value. Query objects have a null prototype.
  - `bodyLimit` comes from the last defined value in the option chain, then `start({ bodyLimit })`, then 1 MiB. It applies only when `body` is declared.
- Encode: a `Response` passes through, ignoring `ResponseStatus`. Otherwise the status is `ResponseStatus`, or 200, or 204 for `undefined`. A written `success` Schema encodes the value (`orDie`, so an encode failure is a defect and an empty 500). `undefined`, 204, 205 and 304 send no body. `null` is JSON `null`.
- An unhandled `ParseError` answers 400 with the `DecodeError` JSON. `wire.ts` now exports `readBody` and `decodeError`.
- `start` keeps `registry` and the explicit `origins` check at the call, so `DuplicateServerFn` and `InvalidOrigin` still throw synchronously. Explicit `services` are de-duplicated by Tag identity (first entry wins). The memoized first-request load does three things:
  - merges the Controllers
  - throws an `Error` naming the file for a `bodyLimit` that is not a positive integer
  - builds `endpoint(...)` over the union of `start({ origins })` and every option file's `origins`, normalized and de-duplicated
- `serveController` now takes `{ status, bodyLimit }` (`ServeDefaults`) as its third argument.
- Tests:
  - New `controller-decode.test.ts`, through `fetch`: decode (repeated query keys, number and boolean codecs, `[[id]]`, splat, extra keys, all issues), content types, 413 by declared length and by stream, 1 MiB minus 100 accepted, `bodyLimit` specificity and unread body, every R16 status, `null`, `Response` passthrough, success-Schema field drop, encode defect, `wrap` order, decode failure inside `wrap`, and `Redirect`/`NotFound` passthrough.
  - `start.test.ts` gains a `merge` block: services de-duplicated by Tag next to a duplicate `serverFn` throw, the `origins` union, the `start({ bodyLimit })` fallback, and `bodyLimit` load failures for 0, -1, 1.5, Infinity and NaN. Every `start` in that file shares one `base` layer and `onError`, so a reconfigure is harmless.
  - `controller-dispatch.test.ts`: `echo` and the status entry now declare a `params` Schema (only declared parts reach a method).
- Mutation check: each of 11 code mutations (content-type check, array query, `bodyLimit` order, null-body set, 400 mapping, empty body, `void` default, services dedupe, `origins` union, `bodyLimit` validation, start `bodyLimit` passthrough) turned at least one new test red. The code was then restored.

Follow-ups, not built:
- An invalid `origins` export in a file rejects the load with `InvalidOrigin`. No test covers it, because the spec lists no error for it.
- A `ParseError` that a method raises itself (not from decode) also answers 400 when `wrap` leaves it.
- Task 12 should document the `bodyLimit`/`origins` merge in the start README.

Gates (post-edit):
- `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld`: green, 28/28 tasks, start 184 tests (134 before).
- `pnpm --filter realworld check`: green.
- Fixture graph check: the diff is empty (no public export change).
- `prettier --check packages/start/src`: clean.
- Baseline: green via the unittest receipt at 465aae15 (only `.flow/` changed since then); `realworld check` and the fixture check were run before the edits.

GATE_SKIPPED:unittest:green-receipt 465aae15 - baseline reused from prior post-gate pass

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - ran (sonnet; updated tasks 8, 10, 12)
## Evidence
- Commits: 7938605d57d0a7c7870627a6713ebb03c646bd85
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts), GATE_SKIPPED:unittest:green-receipt 465aae15 - baseline reused from prior post-gate pass
- PRs: