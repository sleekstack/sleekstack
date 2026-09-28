---
satisfies: [R3, R11]
---
# fn-3-sleekstack-kit-effect-free-di-facade.6 core: enforce module privacy (PrivateDependency), supersede ADR 0002

## Description
Enforce module privacy in @sleekstack/core, reversing ADR 0002 ("exports are descriptive only"). A module's private Layers must be visible only inside that module. Kit (R3) inherits the rule.

**Size:** M
**Files:** packages/core/src/{graph.ts,errors.ts,scope.ts,index.ts}, packages/core/src/__tests__/privacy.test.ts, docs/adr/0006-enforce-module-privacy.md, docs/adr/0002-module-isolation-type-level-only.md (superseded note), CONTEXT.md (Module entry), packages/kit/src/__tests__/module.test.ts (a kit-level privacy test)
**Touches:** [packages/core/src/**, docs/adr/**, CONTEXT.md, packages/kit/src/__tests__/module.test.ts, packages/kit/src/errors.ts]

### Approach
- Semantics: an omitted `exports` means all public (keeps fn-1/fn-2 apps working); a given `exports` makes every other Tag the module provides private. A private Tag may be required only by nodes owned by the same module. Imports don't see private Tags, and neither do root consumers: `useService`, action/query deps, per-call `provide` entries and child scopes.
- Graph build: when a node outside the owning module requires a private Tag, raise a new tagged `PrivateDependency {tag, module, requiredBy}` (graph.ts isPrivate at :117, :254 already computes the flag).
- Runtime lookups: scope/child resolution from outside rejects a private Tag with the same error. Shadowing a private Tag from outside counts as providing a new public one, not a reach-in.
- Kit: add `PrivateDependency` to `normalize` codes; a kit test covers it through `module({exports})`.
- The ADR 0006 supersedes 0002; add a superseded banner to 0002 and update the CONTEXT.md Module/Graph text ("exports are enforced").
- Run the whole monorepo test suite: fn-2 showcase and playground must stay green (fix their module exports if they relied on reach-ins).

### Investigation targets
**Required:**
- packages/core/src/graph.ts:100-140, 240-260; module.ts:84-116; scope.ts
- docs/adr/0002-module-isolation-type-level-only.md
- apps/showcase/src/domain/modules.server.ts (private service usage)

## Acceptance
- [ ] outside node requiring a private Tag -> PrivateDependency at buildGraph
- [ ] runtime lookup of a private Tag from outside (useService / action dep / child scope) rejects with PrivateDependency
- [ ] same-module requires still work; omitted exports = all public; shadowing from outside is allowed
- [ ] kit maps PrivateDependency via normalize (test)
- [ ] ADR 0006 + 0002 superseded + CONTEXT.md updated
- [ ] `pnpm typecheck && pnpm test` green monorepo-wide


## Done summary
Enforced module privacy: PrivateDependency at buildGraph and in child scopes; scope context hides private Tags, useService and kit action deps report PrivateDependency; omitted exports = all public; ADR 0006 supersedes 0002; CONTEXT.md updated. Tests: core privacy.test.ts, kit module.test.ts + next.test.ts. baseline: green.

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 60a978d06948510873639b5f58887745abc0cd05
- Tests: pnpm typecheck && pnpm test
- PRs: