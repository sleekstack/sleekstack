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
- Carry-over from task 1: extraction currently tracks list construction syntactically (push / splice / helper returns) and reports `.map` / loop-built `provide` lists as `Computed`. Spec R7 says types, not syntax: read the checker's element type of `provide` / `imports` arrays so `.map`, loops and conditionals over precisely typed values are accepted and over-approximated; only imprecise types (`any`, widened `Layer<any>[]`, non-literal keys) error. Add a fixture for a `.map`-built list and one for a loop.
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
- [ ] `.map`-built and loop-built `provide` lists with precise types extract every member; an `any`-typed list still errors
- [ ] Clean project yields no errors

## Acceptance
- [ ] TBD

## Done summary
Added packages/analyze/src/validate.ts porting core's whole-graph checks (ModuleCycle, DuplicateModule, AmbiguousProvider, MissingDependency, PrivateDependency, CaptiveDependency, DependencyCycle) with core's codes/messages, reporting every violation at its declaration; ambiguous Tags poison no downstream check, cyclic top modules still get a root. Extraction now evaluates .map/flatMap/filter/slice/concat, for-of loops, conditional elements and local helpers (parameters bound per call) over precisely typed sources, with object identity keyed per evaluation instance; any and Layer<any>[] fail closed. One kit + core fixture per graph error asserts code and file:line and that the runtime throws the same code; computed-lists and ambiguity-follow-on fixtures cover the list rules.

Tests: packages/analyze/src/__tests__/fixtures.test.ts (13 tests total in package).
Not done: deriving Tags from checker element types alone (kit Layer<T> carries no Tag key, so an ambient/imported list with no readable initializer still fails closed as Computed) - reviewers raised this; left as fail-closed per R7.
Tier: implementer (opus, medium) per project CLAUDE.md

stage: impl-review - ran (codex fan-out NEEDS_WORK x3 rounds on successive heads -> single re-review SHIP)
## Evidence
- Commits: 177494a299bb5ec78ccb9bd4d570e004b7666c2d, 693a73a7d8b5a79318ddaa581f0a16a8c764b0de, 10bda7ceaf01dd690984ca50f1e290c1960911c5, 9be8a58ed686345b16aed98464dad74ee1037956
- Tests: cd packages/analyze && pnpm vitest run, cd packages/analyze && pnpm tsc --noEmit
- PRs: