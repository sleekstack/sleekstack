---
satisfies: [R1, R2, R3]
---
# fn-62-router-link-takes-anchor-attributes-and.1 Link takes anchor attributes; analyzer regression fixture; docs

Touches: packages/router/src/link.ts, packages/router/src/__tests__/**, packages/router/README.md, packages/ui/src/jsx-types.ts, packages/ui/src/index.ts, packages/analyze/src/__tests__/fixtures/**, packages/analyze/src/__tests__/components.test.ts, apps/docs/content/docs/routing.mdx

## Description
Extend `LinkProps` with the non-event anchor attributes and pass them to the `<a>`; add the analyzer regression fixture; update the router README and the routing docs line. The analyzer needs no source change (a probe in `apps/realworld` already reports no diagnostics); add one only if the fixture fails.

**Size:** M
**Files:** `packages/router/src/link.ts`, `packages/router/src/__tests__/link.test.ts`, `packages/router/src/__tests__/requirements.test-d.ts`, `packages/router/README.md`, `packages/ui/src/jsx-types.ts` and `packages/ui/src/index.ts` (only if a ui anchor-attributes type is exported), a fixture under `packages/analyze/src/__tests__/fixtures/` registered in `components.test.ts`, `apps/docs/content/docs/routing.mdx`

### Approach
- `link.ts:7-17` `LinkProps`: add the anchor attributes minus `href`, `children` and `on*`; re-declare `href: string`. Destructure `table`, `code`, `loaders`, `prefetch` and pass the rest into both `jsx('a', ...)` branches (`link.ts` around line 32), so `prefetch={false}` keeps the attributes.
- The typed `a` attributes live in `packages/ui/src/jsx-types.ts` (`HtmlAttrs.a` ~189, `ClassAttr` line 13, `IntrinsicElementMap` line 504); `ClassAttr` and `V` are file-local, and a plain `Omit` collapses the class/className union. Use a distributive omit, or export one anchor-attributes type from ui (a new public name: ADR 0019; run the fixture graph check from AGENTS.md before and after).
- Event handlers are excluded by design (see spec Architecture): `jsx()` does not merge handlers (`jsx-runtime.ts` `isEvent`), and the analyzer does not inspect closures on library components.
- Analyzer fixture: next to `fixtures/ui-router-roots/app.tsx:17` (already renders `<Link href table>`), render `<Link class aria-current rel data-x>` with zero diagnostics, and a local component named `Link` that stays app-checked. `libId` (`packages/analyze/src/extract.ts:34-45`) and `components.ts:371` already resolve router `Link` by declaration.
- Docs: router README (lines ~17 and ~53) and `apps/docs/content/docs/routing.mdx:14`; never hand-edit `apps/docs/content/docs/api/*.md`.
- Update the stale memory entry `.flow/memory/bug/integration/sleekstack-check-cannot-read-router-2026-10-15.md` to say router `Link` is now analyzed (use flowctl memory commands if available, else edit the file).

### Investigation targets
**Required**:
- `packages/router/src/link.ts`, `packages/router/src/history.ts:92-107`
- `packages/ui/src/jsx-types.ts:10-13,117-119,189,500-504`, `packages/ui/src/jsx-runtime.ts:62-128`
- `packages/router/src/__tests__/link.test.ts`, `packages/router/src/__tests__/requirements.test-d.ts`
- `packages/analyze/src/__tests__/fixtures/ui-router-roots/app.tsx`, `packages/analyze/src/__tests__/components.test.ts:10-18,44`

### Acceptance
- [ ] Runtime tests: attributes render on the `<a>` and no `table`/`code`/`loaders`/`prefetch` attribute; SSR + hydrate keeps them; hover/focus prefetch with attributes present; `prefetch={false}` keeps attributes and attaches no handlers; cross-origin and unmatched `href` prefetch nothing; a failing prefetch stays silent
- [ ] Type tests: `class` with `className`, missing `href`/`table`, an atom `href` and any `on*` prop are errors; existing callers' `R` inference is unchanged
- [ ] Analyzer fixture reports no diagnostics for the new attributes and keeps a local `Link` app-checked
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/analyze --filter=sleekstack` green; fixture graph check output unchanged if a ui name was added

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
