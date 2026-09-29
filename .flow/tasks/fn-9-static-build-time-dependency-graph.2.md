---
satisfies: [R1, R10]
---
# fn-9-static-build-time-dependency-graph.2 Analyzer validations and per-error fixtures

## Description
Implement the whole-graph checks in the analyzer (missing, cycle, captive, ambiguous provider, private-Tag use, module cycle, duplicate module) with the same error codes as core, plus one tiny fixture project per error asserting code and file:line.

**Size:** M
**Files:** packages/analyze/src/{validate.ts,toposort.ts,lifetime.ts}, packages/analyze/fixtures/**, packages/analyze/src/__tests__/fixtures.test.ts
**Touches:** [packages/analyze/**]

### Approach
- Port the logic from core's validation, keeping error codes and messages, not importing core's runtime graph.
- Shadowing and local-over-import resolution must match `resolveEntries`.

### Investigation targets
**Required**:
- `packages/core/src/graph.ts:156-292` — resolveEntries, buildGraph checks, toposort
- `packages/core/src/lifetime.ts:11-38` — allowed matrix and checkLifetimes
- `packages/core/src/cycle.ts:21` — module cycle / duplicate module
- `packages/core/src/errors.ts:54` — GraphError union
- `apps/showcase-kit/src/errors/cases.server.ts:31-52` — cases to mirror as fixtures

### Acceptance
- [ ] Fixture per graph error asserts code and location
- [ ] Each error also reproduces from core-style declarations
- [ ] Clean project yields no errors

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

