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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
