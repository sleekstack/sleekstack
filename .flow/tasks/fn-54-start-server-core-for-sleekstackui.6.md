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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
