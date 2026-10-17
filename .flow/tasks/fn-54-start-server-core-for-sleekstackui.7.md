---
satisfies: [R12]
---
# fn-54-start-server-core-for-sleekstackui.7 analyzer: startRouter and handle as roots, Link readable

## Description
Make `sleekstack check` read router entries so JSX pages are checked against the entry's layer (ui types JSX as requirement-free, so the compiler cannot). Also closes the known gap that the analyzer does not read the router's `Link`.

**Size:** M
**Files:** packages/analyze/src/components.ts; new fixture packages/analyze/src/__tests__/fixtures/ui-router-roots/ (app.tsx, tsconfig.json) with `// @error` markers; packages/analyze/src/__tests__/components.test.ts (fixture list)
**Touches:** [packages/analyze/src/**, packages/cli/src/__tests__/**]

### Approach
- Add `startRouter` and `handle` call sites as tree roots beside `mount` and `resume`: resolve the `router({ table, pages, notFound })` argument's object literal, take each page's `render` (and the not-found render) as a component root; the root layer is the entry options' `layer` plus the services the router supplies (`Route`, `Loaders`, `Transfer`, `Store`).
- Reuse the existing `mount` root machinery (layer tags, component build, `check`); do not add a new `AnalyzeCode` (reuse the missing-dependency and unresolved codes). A router that is not an object literal reachable from the call is `Unresolved`.
- Teach component resolution that the router's `Link` is a requirement-free component (it is a ui component today, so resolve it like any other imported component rather than special-casing by name).
- Equivalence pin: every existing analyzer fixture result is unchanged; run the AGENTS.md fixture graph check before and after and diff.
- Run `sleekstack check` on the showcase and report whether the router demo is now covered.

### Investigation targets
**Required**:
- `packages/analyze/src/components.ts` (the `mount` root near the end of `analyzeComponents`, `resumeRoot`, `component`, `build`, `check`)
- `packages/analyze/src/__tests__/components.test.ts` and `fixtures/ui-missing/app.ts` (marker style)
- `packages/router/src/resolve.ts`, `history.ts`, `server.ts` (entry and `Router` shapes as the router task left them)
- `apps/showcase/src/pages/router.tsx`
**Optional**:
- `packages/analyze/src/__tests__/fixtures/ui-resume-clean/`
- `docs/adr/0036-*.md`

## Acceptance
- [ ] A fixture with a JSX page needing a service absent from the `startRouter` / `handle` layer reports the missing dependency at that page; the same page with the service provided reports nothing
- [ ] A page using the router's `Link` is analyzed without an unresolved report
- [ ] A router passed as a non-literal is reported as unresolved
- [ ] All existing analyzer fixtures keep their results; fixture graph check output is identical before and after
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
