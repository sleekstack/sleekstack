---
satisfies: [R4]
---
# fn-16-query-layer-follow-ups-kit-ssr-prefetch.3 react: useMutation idle on the server; delete the showcase workaround

## Description
`useMutation` must not throw `AtomsClientOnly` in a server render. Only `useMutation` relaxes; `useQueryStore` keeps its guard for other hooks. Coordinates with fn-17 R2 (same module): implement on top of its server read path.

**Size:** S
**Files:** packages/react/src/query.ts, packages/react/src/__tests__/ (server render test), apps/showcase/src/client/services/useBoardMutation.ts (delete), apps/showcase/src/client/TaskDetail.tsx, apps/showcase/src/client/ProjectView.tsx
**Touches:** [packages/react/src/query.ts, packages/react/src/__tests__/**, apps/showcase/src/client/**]

### Approach
- The throw is in `useQueryStore` (`packages/react/src/query.ts:24-26`); `useMutation` is at :295. Return the idle result on the server; a `mutate` call during render throws a named error.
- Replace the `useBoardMutation` call sites (`TaskDetail.tsx:17,28,63`, `ProjectView.tsx:16,38`) with the real `useMutation` and delete the workaround.
- Kit `useMutation` (`packages/kit/src/react/index.ts:112`) inherits the fix; confirm with a kit test.
- Read memory: island-server-branch-needs-the-same-provider-nesting.

## Acceptance
- [ ] a server render of a form using useMutation returns idle (test)
- [ ] mutate during render throws a named error (test)
- [ ] useBoardMutation.ts removed and showcase tests pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
