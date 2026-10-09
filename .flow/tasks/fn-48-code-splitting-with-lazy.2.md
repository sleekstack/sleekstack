---
satisfies: [R5, R6, R9]
---
# fn-48-code-splitting-with-lazy.2 Chunk-split proof, size budget and README

## Description
Chunk-split proof, size budget and README. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** apps/ui-demo/src/size/lazy.tsx (new entry), apps/ui-demo/test/size.test.ts (limits at lines ~45-47), docs/adr/0022 table, packages/ui/README.md
**Touches:** [apps/ui-demo/src/size/**, apps/ui-demo/test/size.test.ts, docs/adr/0022-*.md, packages/ui/README.md]

### Approach
- Add a `lazy` size entry with a dynamic import; assert `lazyGz > 0` and the eager bundle excludes the module; size test already reports lazy chunks separately.
- Any deliberate budget increase updates the limit and ADR 0022 together.

## Acceptance
- [ ] Chunk is split and eager size within budget (R5, R9)
- [ ] README documents lazy with one example (R6)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
