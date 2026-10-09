---
satisfies: [R7, R8, R9]
---
# fn-43-typed-dom-for-sleekstackui.3 Fix consumers, docs and verify

## Description
Fix consumers, docs and verify. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** apps/ui-demo/src/**, apps/ui-demo/fixtures/**, packages/query/src/__tests__ (host JSX), packages/analyze and cli fixtures, packages/ui/README.md, a new ADR in docs/adr
**Touches:** [apps/ui-demo/**, packages/query/src/__tests__/**, packages/analyze/src/__tests__/fixtures/**, packages/cli/src/__tests__/fixtures/**, packages/ui/README.md, docs/adr/**]

### Approach
- Run typecheck across every consumer using the `@jsxImportSource @sleekstack/ui` pragma and fix real mistakes the new types expose (no runtime edits).
- Re-run analyzer and cli suites (AGENTS.md rows) to prove handler return types are still read the same.
- Update the README rows for `useRef`, `onXxx` and the JSX paragraph; add an ADR for per-tag host typing with `class` canonical, referencing ADR 0026.

## Acceptance
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack` passes with no runtime change (R7, R8)
- [ ] README documents class, typed attributes, events and refs (R9)
- [ ] ADR written and indexed


## Done summary
Consumers already type-check under the new host JSX types (ui-demo's dateTime fix landed in .1); no code change needed. README documents per-tag attributes, class/className, typed on* events and element refs; ADR 0031 (typed host elements, referencing 0026/0028) added and indexed. No public export names changed; generate:api produced no diff.

stage: impl-review - ran (triage_skip SHIP: docs-only)
Tier: implementer opus at medium
## Evidence
- Commits: 5038018b4d8f40beb1ee5b78a9d3025803541e88, 254d58d38914921c189991a3b47c54eb183f574b
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack (11/11 green at ea716e4; later diff docs-only)
- PRs: