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
`UiPanel` is now a `@sleekstack/ui` generator component (a `useLocal` tick plus a `useEffect` interval replace `useState`/`useEffect`; the instance tree is a recursive `Tree` component), and `packages/devtools/src/ui/` imports no `react` or `@sleekstack/react`. `uiTrace()` and every exported name and prop are unchanged. The panel tests run on `@sleekstack/testing` (`render`, `flush`) with every original assertion kept, plus one new test that pins the poll (confirmed red with polling broken). The showcase opener and the docs snippet now mount the panel with ui `mount`, and the dev-only dynamic import stays.

Edits outside the declared Touches, all needed to keep showcase green or found by review:
- `apps/showcase/src/devtools.tsx`: the opener used a React root; it now uses ui `mount`.
- `apps/showcase/test/architecture.test.ts`: the devtools file may now import `@sleekstack/ui` and `effect` instead of `react-dom/client`.
- `apps/showcase/test/fixtures.test.ts`: the analyzer now sees the panel mount as a fifth tree (4 -> 5, still error-free).
- `packages/devtools/README.md` and `apps/docs/content/docs/ui-devtools.mdx`: no longer call `UiPanel` a React component (review finding).
- `pnpm-lock.yaml`: `@sleekstack/testing` devDependency, no sleek-codes entries.

Notes for later tasks:
- `src/index.tsx` still imports React for `SleekStackDevtools`, which task .3 converts. The package keeps its React dev and peer deps until then.
- Follow-up: the analyzer (`packages/analyze/src/components.ts`) overflows the stack on a self-recursive plain mapper function such as `.map(tree)` inside `tree`. Recursive components are guarded, so `UiPanel` uses one.
- A gate run flaked once on the untouched React `devtools.test.tsx` "Queries tab" test. It passed 3 times standalone and on the full gate re-run.

Tier: opus at medium

Tests: `pnpm turbo run test typecheck --filter=@sleekstack/devtools... --filter=showcase` (green), `pnpm turbo run typecheck --filter=docs` (green).
baseline: green (`pnpm turbo run test typecheck --filter=@sleekstack/devtools... --filter=showcase`, pre-edit)

stage: impl-review - ran (codex fan-out --base master: correctness NEEDS_WORK, contracts NEEDS_WORK, integration SHIP -> 2 fixes -> re-review SHIP)
## Evidence
- Commits: afec0154f34690f4427a33740060c654118ea182, dc78f540722e5d36a9789315373e3ed0ed2ae212, 713701233c151d4c7323a45d61f9a2d034c453a9
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/devtools... --filter=showcase, pnpm turbo run typecheck --filter=docs
- PRs: