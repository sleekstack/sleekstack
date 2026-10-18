---
satisfies: [R3, R7]
---
# fn-55-remove-kit-react-next-and-islands.4 analyzer: drop kit graph extraction

## Description
The analyzer reads kit's `tag`, `layer`, `effect`, `module`, `atom`, `defineEffect` / `defineQuery` / `runOperation`, `cachedQuery` and `mutation`. With kit gone it reads core modules, plain Layers, runtime roots and ui trees only.

**Size:** M
**Files:** packages/analyze/src/extract.ts, model.ts, index.ts, errorCodes.ts, components.ts if it names kit; packages/analyze/src/__tests__/ fixtures and tests that import kit (kit-app, actions, actions-roots and any other kit user); error-code docs
**Touches:** [packages/analyze/**]

### Approach
- First save the fixture graph check output and every non-kit analyzer fixture result; they are the equivalence pin and must be identical after.
- Remove the `kit/*` call tables and the kit/next action roots; keep the core `makeModule`, plain-Layer and runtime (`configureRuntime`, `runEffect`) paths. Where a kit-only concept has a core equivalent (atoms), keep reading the core one.
- Delete fixtures that exist only for kit; convert a fixture that exercises shared behavior to core or plain Layers instead of deleting its coverage.
- A code only the kit path raised is removed with its table row (closed `AnalyzeCode` rule); regenerate any docs derived from the codes.
- The server-operation roots (`defineEffect`, `defineQuery`) disappear until `@sleekstack/start` adds its own function roots; note this in the summary.

### Investigation targets
**Required**:
- `packages/analyze/src/extract.ts` (call tables near the top, `layer`/`effect` branches, atom family)
- `packages/analyze/src/model.ts`, `errorCodes.ts`, `index.ts`
- `packages/analyze/src/__tests__/fixtures.test.ts` and the fixtures importing kit
- AGENTS.md fixture graph check
**Optional**:
- `docs/adr/0011-static-build-time-dependency-graph.md`

## Acceptance
- [ ] No analyzer source or fixture imports or names kit; kit-only fixtures and codes are gone
- [ ] Every non-kit fixture's analyzer result is identical before and after (saved and diffed)
- [ ] The fixture graph check from AGENTS.md is updated to the remaining fixtures, and its output matches before/after for them
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
