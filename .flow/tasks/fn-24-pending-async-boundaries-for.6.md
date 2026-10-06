---
satisfies: [R7]
---
# fn-24-pending-async-boundaries-for.6 ui-demo: Pending around a useSuspenseQuery list

## Description
Real screen proving the feature: the backlog list under Pending with a spinner fallback, analyzer-clean.

**Size:** S
**Files:** apps/ui-demo/src/components.tsx, apps/ui-demo/test/app.test.ts
**Touches:** [apps/ui-demo/src/components.tsx, apps/ui-demo/test/app.test.ts]

### Approach
- Replace the backlog `useQuery` (components.tsx ~l.189) with `useSuspenseQuery` inside `<Pending fallback=...>`; keep the existing Boundary placements.
- Update the backlog test (app.test.ts l.74-86, `vi.waitFor`) to see fallback then items.

### Investigation targets
**Required** (read before coding):
- apps/ui-demo/src/components.tsx l.3-4 imports, ~l.189
- apps/ui-demo/test/app.test.ts l.74-86

## Acceptance
- [ ] Demo shows fallback then the list; its test passes (R7).
- [ ] `sleekstack check` on ui-demo is clean.
- [ ] `pnpm turbo run test typecheck --filter=ui-demo`.

## Done summary
Backlog list in ui-demo now uses useSuspenseQuery inside Pending (spinner fallback), wrapped in Boundary tag QueryFailed; SSR and mount tests cover fallback then list. Analyzer clean.

baseline: green via handoff (5e441d0)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 7d3347e9546ddf7b29da19eb942b092ab4745ac0
- Tests: pnpm turbo run test typecheck --filter=ui-demo
- PRs: