---
satisfies: [R6]
---
# fn-20-adx-agent-developer-experience.4 kit: rename next inline runner effect -> runOperation with deprecated alias; ADR 0019

## Description
One public name, one meaning. Rename the `kit/next` inline runner; `kit/src/effect.ts` keeps `effect`. Depends on task 2 only because both edit `extract.ts`.

**Size:** L-bounded (mechanical; one behavior pin)
**Files:** packages/kit/src/next/action.ts, packages/kit/src/next/index.ts, packages/analyze/src/extract.ts, packages/kit/src/__tests__/, analyzer fixtures, apps/showcase-kit/src/islands/{islands.actions.ts,Ping.tsx}, apps/showcase/src, apps/ui-demo/src/domain.ts, docs/adr/0019-*.md, docs/adr/README.md, CONTEXT.md, apps/docs/content/docs, READMEs
**Touches:** [packages/kit/src/**, packages/analyze/src/extract.ts, packages/analyze/src/__tests__/**, apps/**, docs/adr/**, CONTEXT.md, packages/*/README.md]

### Approach
- Definition `packages/kit/src/next/action.ts:186` (exported `kit/next/index.ts:3`); analyzer ids `kit/next/action#effect` (`extract.ts:39`) and `kit/effect#effect` (:450): recognize both the new id and the deprecated alias (alias must resolve to the same id).
- Behavior pin: before renaming, snapshot `sleekstack check --json` for showcase-kit and diff after; output must be identical modulo names.
- Add a test that no two kit entry points export the same name with different meanings.
- ADR 0019 (0016/0017 are reserved); update CONTEXT.md lines naming both meanings (:56,60,143,147) and docs mdx; do not hand-edit generated `api/*.md`.

## Acceptance
- [ ] rename done; deprecated alias type-checks and is analyzed
- [ ] duplicate-export-name test passes
- [ ] check --json snapshot for showcase-kit unchanged modulo names
- [ ] ADR 0019 and CONTEXT.md updated

## Done summary
Renamed kit/next effect -> runOperation; deprecated alias analyzed; export-name clash test; ADR 0019; CONTEXT/docs updated. showcase-kit check --json byte-identical before/after.
## Evidence
- Commits: 6cae326204e1689012913bc0378bdcb1edd74d9c
- Tests: vitest kit/analyze/islands, tsc kit/analyze/islands/showcase-kit, sleekstack check --json diff showcase-kit
- PRs: