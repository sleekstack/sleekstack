---
satisfies: [R2, R3, R7]
---
# fn-9-static-build-time-dependency-graph.5 Analyzer: infer action deps from yield* and enforce the graph

## Description
Teach the analyzer to read the Tags each `defineEffect` / `defineQuery` / `effect` / `query` body yields (through helper generators), and fail when a yielded Tag is unprovided, unresolvable, private, or missing from the still-declared deps array (drift). This lands before task 4 removes the arrays, so action bodies are never unvalidated at any commit; `opts.scope` entries are read as edges once task 4 adds them.

**Size:** M
**Files:** packages/analyze/src/{actions.ts,validate.ts}, fixtures
**Touches:** [packages/analyze/**]

### Approach
- Use the checker on the generator's yield type; resolve symbol to declaration, fall back to the literal key; conditional yields over-approximate; anything unresolvable is a located error.

### Investigation targets
**Required**:
- `packages/kit/src/next/action.ts` — define* signatures
- `apps/showcase-kit/src/__tests__/graph.test.ts:19-26` — cross-check to delete

### Acceptance
- [ ] Fixtures: unprovided, private, `any`-typed and computed Tags each error with location
- [ ] showcase-kit check passes with arrays still declared; a yield outside the array errors
- [ ] Helper-generator `yield*` is followed

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

