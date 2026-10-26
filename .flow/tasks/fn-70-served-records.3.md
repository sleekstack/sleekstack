---
satisfies: [R4]
---
# fn-70-served-records.3 start: records() runtime, the served GET and PATCH methods

Touches: [packages/start/src/records.ts, packages/start/src/index.ts, packages/start/src/__tests__/**]

## Description
The server half of `export default records(Record)`: a function of the record that yields the two Controller Method entries, with the failure-to-status mapping. It is runtime only; recognition is the Analyzer's task, wiring is ui-vite's.

**Size:** M
**Files:** `packages/start/src/records.ts` (new), `packages/start/src/index.ts`, `packages/start/src/__tests__/records.test.ts` (new), a `records.test-d.ts`

### Approach
- `records(record)` returns a value carrying the record; `recordsMethods(value)` (internal, used by generated code) builds `ControllerMethodEntry` objects (`packages/start/src/app.ts:10-27`) for `GET` and `PATCH`: `params` is `{ id: string }`, `body` is `record.change`, and the answer encodes through the record's Struct Encoded side.
- `run` calls the adapter Tag directly (`yield* record.adapter`), never `record.find`/`commit` (those need a `Store`). Catch `RecordNotFound` and `RecordRejected` inside `run` and answer 404/422 with the JSON bodies from the spec through `ResponseStatus` (`packages/start/src/services.ts`); everything else must propagate to `wrap` unchanged.
- A record with no `adapter` is a type error on `records(...)`; a record whose Schemas need a Service is `never` for the argument type (mirror `useDraft`'s conditional type at `record.ts:46-50`).
- Test with a hand-built `ControllerEntry` served by the fn-68 dispatcher, as `controller-dispatch.test.ts` does, and an in-memory adapter Layer; no analyzer or Vite involved.

### Investigation targets
**Required**:
- `packages/start/src/app.ts:10-80` - ControllerMethodEntry and ControllerEntry
- `packages/start/src/controller.ts` - decode, encode, wrap chain (how a `Response`-returning run and `success` interact)
- `packages/start/src/services.ts` - `ResponseStatus`
- `packages/start/src/__tests__/controller-dispatch.test.ts` - how entries are driven in tests
- `packages/model/src/adapter.ts:29-35` - `RecordAdapter`

### Acceptance
- [ ] GET answers the wire form and 404 for `RecordNotFound`; PATCH answers the saved wire form, 422 for `RecordRejected`; each pinned by a named test
- [ ] A PATCH body missing an editable field is 400 `DecodeError` unhandled; a read-only key in the body is ignored; a non-JSON content type is 415; `DELETE` is 405 with `Allow`
- [ ] A failure that is neither error reaches a `wrap` unchanged; an answer that does not encode is a defect
- [ ] No `Store` is required in the handler's `R` (type test)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` passes

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
