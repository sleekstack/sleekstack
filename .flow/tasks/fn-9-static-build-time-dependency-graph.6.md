---
satisfies: [R9, R10]
---
# fn-9-static-build-time-dependency-graph.6 Parity test, showcase graph and errors pages on the analyzer report, test port list

## Description
Add the parity test (for both apps/showcase-kit and the core-declared apps/showcase) (analyzer graph equals `snapshot(AppModule)` for showcase-kit), switch the showcase graph and errors pages (both showcase apps) to the analyzer's prebuilt JSON report, and commit the list of every test asserting a build-time graph error with its port target (fixture) or deliberate drop.

**Size:** M
**Files:** apps/showcase-kit/{app/graph/page.tsx,src/errors/cases.server.ts}, apps/showcase/{app/graph/page.tsx,src/errors/**}, parity test, docs/adr or .flow note for the port list
**Touches:** [apps/showcase-kit/**, apps/showcase/**, packages/analyze/src/__tests__/**]

### Approach
- Runtime-only cases (`LayerFailed`, `HandlerFailed`, `DuplicateTag`) stay as runtime demos.

### Investigation targets
**Required**:
- `apps/showcase-kit/app/graph/page.tsx:13`
- `apps/showcase-kit/src/errors/cases.server.ts:31-52`
- core / kit tests using buildGraph (scope, cycle, lifetime, privacy, graph, walk, resolve, spike; kit errors, tag, module, effect)

### Acceptance
- [ ] Parity test passes on nodes, edges, private Tags and shadowing
- [ ] Pages render from the report
- [ ] Port list committed and every build-time-error test is ported or listed as dropped

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

