---
satisfies: [R10, R11]
---
# fn-54-start-server-core-for-sleekstackui.6 testing helpers, ADRs, CONTEXT terms and AGENTS.md row

## Description
Add the no-HTTP helpers to `@sleekstack/testing` and record the work: ADRs for the decisions this phase made, CONTEXT terms, the AGENTS.md verify row and the package README.

**Size:** M
**Files:** packages/testing/src/serverFn.ts and index.ts, tests in packages/testing/src/__tests__/; docs/adr/0039-*.md (and a second ADR only if a decision genuinely differs); CONTEXT.md; AGENTS.md; packages/start/README.md; docs/adr/README.md row
**Touches:** [packages/testing/**, docs/adr/**, CONTEXT.md, AGENTS.md, packages/start/README.md]

### Approach
- `callServerFn(fn, input, { layer })` and a request helper run through the same dispatch as `start(...).fetch` with a test layer, without HTTP; the testing package gains `@sleekstack/start` as a dev/peer dependency only if it needs the types.
- ADR content: name and packaging, type-enforced boundary (cite the D2 spike), router requirement typing, wire format, explicit registry over a compiler, router as a dependency of start. Supersedes nothing; ADR numbering follows the existing sequence.
- CONTEXT: **Server Function** and **Server Endpoint**; keep **Action** as the Next Server Action (see the `_Avoid_` lines of Form Action and Action).
- AGENTS.md: add a start row to the verify table.
- Resolve the `docs/proposals/start-framework.md` open items this phase settled (mark D1, D2, D4, D6 decided with the ADR link) so the proposal does not contradict the ADR.

### Investigation targets
**Required**:
- `packages/testing/src/index.ts`, `render.ts`, `mockLayer.ts`
- `docs/adr/README.md` and the latest ADR for format
- `CONTEXT.md` (Action, Form Action, Request Scope entries)
- `AGENTS.md` verify table
**Optional**:
- `packages/testing/src/__tests__/testing.test.ts`

## Acceptance
- [ ] `callServerFn` and the request helper exercise a server function and a handler with a test layer and a request, no network (tests, including a decode failure and a declared typed failure)
- [ ] ADR(s) merged into the index; CONTEXT terms added; AGENTS.md verify row added; package README lists exports
- [ ] The proposal's decided items point to the ADR
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/testing --filter=@sleekstack/start...` and the fixture graph check are green

## Done summary
`@sleekstack/testing` now exports `callServerFn(fn, input, { layer, headers? })` and `callHandler(handler, request, { layer })` (`packages/testing/src/serverFn.ts`). Both run through `start(...).fetch` with a test layer and no network. `callServerFn` resolves to an `Exit`: the success value, the declared error, the router's `Redirect` / `NotFound`, `DecodeError` (input the Schema rejects is sent as given, so the server's own decode reports it with field issues), or the cause the error sink got for a defect. `callHandler` resolves to the `Response`. Tests in `packages/testing/src/__tests__/serverFn.test.ts` cover success with a layer and a cookie header (extra output fields dropped), a declared typed failure, a decode failure with the body not run, a redirect, a defect, the request services with `Set-Cookie`, 405 with `Allow`, and control flow as a 404. A mutation of the helper turned 4 of them red first. testing gains `@sleekstack/start` and `@sleekstack/router` as peer and dev dependencies. The lockfile gains 6 lines under packages/testing and no sleek-codes entries.

Docs:
- ADR 0039 (`docs/adr/0039-start-server-core.md`) and its index row. It records packaging, the entry and dispatch order, request services, the D2 boundary (types for loaders and plain-Effect pages, `sleekstack check` roots for JSX), naming, D4, the explicit registry, the client contract (R6 is now "typed from the contract the server function is built from"), the wire, origins validation with app-owned CORS, the testing helpers, the known gaps and the rejected options.
- CONTEXT.md: a Start section with Server Function and Server Endpoint. Action stays the Next Server Action.
- AGENTS.md: a start verify row.
- packages/start/README.md: an exports table.
- docs/proposals/start-framework.md: D1 to D4 and D6 are marked decided with the ADR link, the D2 spike claim is corrected for JSX, and the client bullet and risks are updated.

Markdown was not reformatted (the repo runs prettier on ts only).

Follow-ups:
- `callServerFn` re-reads the envelope with its own copy of wire.ts's `decodeResult`, because packages/start/src was outside Touches. Exporting it for testing would remove the copy.
- Each helper call runs `start`, which reconfigures the process-wide runtime (a console warning per call after the first).

baseline: green (`pnpm turbo run test typecheck --filter=@sleekstack/testing --filter=@sleekstack/start... --filter=showcase`; fixture graph check saved)
stage: impl-review - failed(codex fan-out --base master: all 3 draws hung with no output for 28 minutes and were killed per repo notes; flowctl refunded the round and recorded a transport failure; no verdict)
Tier: implementer opus at medium
## Evidence
- Commits: 4a65c2d6c5a396a212aec3345e3759a79026f3ae
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/testing --filter=@sleekstack/start... --filter=showcase, AGENTS.md fixture graph check (kit-app, effect-app): identical before and after
- PRs: