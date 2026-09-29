---
satisfies: [R3]
---
# fn-11-effect-first-runtime-graph-and-devtools.3 analyze: recognize plain Effect Layers from configureRuntime({ layer }) roots

## Description
Teach the analyzer plain `Layer.*` graphs so the plain-Effect showcase produces edges instead of an opaque node.

**Size:** M
**Files:** packages/analyze/src/extract.ts, packages/analyze/src/model.ts, packages/analyze/src/__tests__/fixtures/plain-layers/*, packages/analyze/src/__tests__/*
**Touches:** [packages/analyze/src/**]

### Approach
- Start after fn-9.7. At extract.ts:444-450 the recognizer accepts kit layer/service/declareLayer and marks a bare core Layer opaque with empty provides/requires; replace that with type-based leaf handling (ROut/RIn Tags via the checker) and structural walking of `Layer.mergeAll/provide/provideMerge`.
- Entry roots: `configureRuntime({ layer })` (extends fn-9 root resolution).
- Unresolvable / `any` layers fail closed with file:line.
- Pitfall (memory): static list evaluation must key object identity by enclosing evaluation instance.
- Fixtures mirror apps/showcase/src/domain/live.server.ts.

### Investigation targets
**Required**:
- packages/analyze/src/extract.ts:79,357-359,444-450,519-523,693-735
- packages/analyze/src/model.ts
- apps/showcase/src/domain/live.server.ts

## Acceptance
- [ ] Showcase plain-Layer fixture yields provides/requires edges and lifetimes
- [ ] An `any`-typed or unresolvable layer produces a file:line error, not an empty graph
- [ ] Existing analyzer fixtures unchanged

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
