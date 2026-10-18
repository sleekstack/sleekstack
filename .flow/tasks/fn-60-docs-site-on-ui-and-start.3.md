---
satisfies: [R2]
---
# fn-60-docs-site-on-ui-and-start.3 docs app: layout components in plain CSS (sidebar, drawer, theme, prev and next)

## Description
Build the site's layout as ui components in a new `apps/docs/src/` tree and a hand-made stylesheet that reproduces today's fumadocs chrome: sidebar built from the order file with collapse and a mobile drawer, light and dark theme with a switcher, a previous and next footer, and prose styling for tables, inline code, code blocks and blockquotes. No Tailwind and no fumadocs CSS.

**Size:** M
**Files:** new apps/docs/src/layout/*.tsx, apps/docs/src/styles.css, tests in apps/docs/src/__tests__/
**Touches:** [apps/docs/src/**]

### Approach
- Components are Effect/ui components using `useLocal` and `useEffect`; test them with `@sleekstack/testing` (`render`, `flush`).
- Sidebar: tree from the order file format (`content/docs/meta.json`: title and ordered list, the API folder as last entry); the current page is highlighted; collapse state and drawer state are local.
- Theme: follows the system setting by default, remembers an explicit choice, and sets the theme before first paint so there is no flash (a tiny inline script in the document shell, or CSS only for the default); with JavaScript off the content stays readable.
- Stylesheet: plain CSS with custom properties for light and dark; copy the structure of today's chrome (`apps/docs/app/docs/layout.tsx`, `app/global.css` use fumadocs-ui styles) from the running site, not from fumadocs source.

### Investigation targets
**Required**:
- `apps/docs/app/layout.tsx`, `app/docs/layout.tsx`, `app/docs/[[...slug]]/page.tsx`, `app/global.css`, `lib/source.ts`
- `apps/docs/content/docs/meta.json`
- `.flow/charts/fn-57/1.json` (D1 inventory of what the chrome includes), `.flow/charts/fn-57/8.md` (the look decision)
- `packages/testing/src/render.ts`
**Optional**:
- `packages/ui/README.md` (hooks)

## Acceptance
- [ ] Tests show the sidebar follows the order file, collapses, and works as a drawer; the previous and next links follow the order
- [ ] Tests show the theme defaults to the system setting, remembers a choice, and sets the theme before first paint
- [ ] A stylesheet covers tables, inline code, code blocks and blockquotes; no Tailwind or fumadocs CSS is referenced
- [ ] `pnpm turbo run test typecheck --filter=docs` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
