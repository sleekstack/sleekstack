---
satisfies: [R2]
---
# fn-55-remove-kit-react-next-and-islands.2 devtools: UiPanel and uiTrace as ui components, no React

## Description
Rewrite the ui devtools (`uiTrace`, `UiPanel`) as `@sleekstack/ui` components so the package no longer needs React for them. This is the half of devtools the showcase already uses.

**Size:** M
**Files:** packages/devtools/src/ui/uiPanel.tsx (to ui JSX), packages/devtools/src/ui/*.ts*, packages/devtools/src/__tests__/uiPanel.test.tsx, apps/showcase/src/pages/devtools.tsx, apps/docs/snippets/ui-devtools.tsx, packages/devtools/package.json
**Touches:** [packages/devtools/src/ui/**, packages/devtools/src/__tests__/uiPanel.test.tsx, packages/devtools/package.json, apps/showcase/src/pages/devtools.tsx, apps/docs/snippets/ui-devtools.tsx]

### Approach
- `uiTrace()` is plain data and stays; `UiPanel` becomes an Effect component with `useLocal` / `useEffect` polling replacing `useState` / `useEffect`.
- Use `@sleekstack/testing` (`render`, `flush`) for the panel tests instead of Testing Library.
- Keep the exported names and props; keep the dev-only mounting rule (dynamic import behind a `NODE_ENV` branch).
- Equivalence pin: every existing `uiPanel` assertion keeps its meaning; the showcase devtools test passes.

### Investigation targets
**Required**:
- `packages/devtools/src/ui/uiPanel.tsx`, `packages/devtools/src/__tests__/uiPanel.test.tsx`
- `packages/devtools/src/index.tsx` (exports of the ui part)
- `apps/showcase/src/pages/devtools.tsx`, `apps/showcase/test/devtools.test.ts`
- `packages/testing/src/render.ts`
**Optional**:
- `docs/adr/0037-ui-render-observer.md`

## Acceptance
- [ ] `UiPanel` renders the same instance tree, atoms, re-run reasons and effect runs, as a ui component; tests prove it with `@sleekstack/testing`
- [ ] The ui devtools entry imports no `react` and no `@sleekstack/react`
- [ ] Showcase devtools test and the docs snippet typecheck pass
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/devtools... --filter=showcase` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
