---
satisfies: [R11]
---
# fn-21-replace-sleekstackquery-with-tanstack.11 ui-demo: query-driven list with a mutation from a guest

## Description
Demonstrate the ui binding (R11, ui-demo part): a query-driven list and a mutation triggered from a React guest, with a jsdom test.

**Size:** M
**Files:** `apps/ui-demo/src/components.tsx`, `apps/ui-demo/src/guests.tsx`, `apps/ui-demo/src/main.tsx`, `apps/ui-demo/src/domain.ts` if a fake API is added, `apps/ui-demo/package.json`, `apps/ui-demo/test/app.test.ts`
**Touches:** [apps/ui-demo/src/components.tsx, apps/ui-demo/src/guests.tsx, apps/ui-demo/src/main.tsx, apps/ui-demo/src/domain.ts, apps/ui-demo/package.json, apps/ui-demo/test/app.test.ts, pnpm-lock.yaml]

### Approach
- Provide `QueryClientLive()` beside `AppLive` in `main.tsx`; a host component reads the list with `yield* useQuery({ queryKey, queryFn: effectFn(...) })` from the existing `TaskRepo`; a guest button calls `mutate` (passed as a prop from a host component using `useMutation`) and the list refetches via `invalidateQueries`.
- jsdom test with a fake repo and `retry: false`: initial pending then data; clicking the guest mutates and the list updates; unrelated siblings keep their DOM nodes.
- Keep `sleekstack check` clean (`apps/ui-demo/test/fixtures.test.ts`).

### Investigation targets
**Required**:
- `apps/ui-demo/src/components.tsx`, `apps/ui-demo/src/domain.ts`, `apps/ui-demo/test/app.test.ts`, `packages/ui/src/query.ts` (tasks 6-7)

### Key context
Guest React state is lost when its parent reader re-renders; keep the mutate button outside the list reader.

## Acceptance
- [ ] The demo list loads through `useQuery` and a guest-triggered mutation updates it (jsdom test)
- [ ] `sleekstack check` on ui-demo is clean; tests, `tsc` and `vite build` pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
