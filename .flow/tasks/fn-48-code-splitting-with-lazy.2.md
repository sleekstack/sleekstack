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
Added the `size/lazy.tsx` budget entry and a test proving the lazy module lands in its own chunk outside the eager bundle (199,423 B gzip, limit 209,000 B, ADR 0022 row added), and documented `lazy` in the ui README. Review fixes: `lazy` now keeps the loaded component's E/R next to `LazyLoadError` (type test), and the analyzer follows `lazy(() => import())` to the default export (`ui-lazy` fixture), so the demo entry stays in the checked project.

stage: impl-review - ran (codex fan-out NEEDS_WORK: analyzer rejected lazy, type erased E/R; fixed; re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 24b50cdf34700652425139482976468890cf3114, 65b2ee4204c6886e0dd9122ca0aeb6eb34034abe
- Tests: pnpm turbo run test typecheck --filter=ui-demo --filter=docs --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack
- PRs: