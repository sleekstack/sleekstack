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
`sleekstack check` now treats `startRouter` and `handle` as component roots. Each root checks every page's render and loaders under a `Route` provide, plus `notFound` without `Route`, against the entry's `layer` plus `Loaders`, `Transfer` and `Store`. The router's own `Redirect` and `NotFound` count as handled. A router that is not a `router({...})` literal reachable through const bindings is reported `Unresolved`. A JSX component declared in a library (a `.d.ts`, `node_modules`, or a sleekstack package, `@sleekstack/router` included) is read from its type, so `Link` resolves without a name special case.

Framework Tags (`Store`, `Route`, `Loaders`, `Transfer`) and the router control errors are matched by declaration, not printed name. A same-named app Tag is file-qualified, and an app error with `_tag: 'NotFound'` stays unhandled. Tests: fixture `packages/analyze/src/__tests__/fixtures/ui-router-roots/` covers a missing page service, a missing loader service, `notFound` without `Route`, the app `Route` and `NotFound` collisions, a shorthand render, a non-literal router (`Unresolved`), and `Link` (no `Unresolved`).

Equivalence: the AGENTS.md fixture graph check output is identical before and after. Showcase `sleekstack check --json` is identical apart from one new clean tree for `src/pages/router.tsx:59` (the `startRouter` in `RouterDemo`), so the router demo, `Link` included, is now covered.

Follow-up (outside Touches): `RouterProvided` in `packages/router/src/resolve.ts` excludes `Route` from the type-level requirements, so a `notFound` needing `Route` still compiles. The analyzer now reports it, but the router type does not.

baseline: green
stage: impl-review - ran (codex fan-out round 1 NEEDS_WORK, 4 findings: Route scoped to notFound, name-matched framework Tags, name-matched control errors, shorthand render; fixed in 9428838; re-review --base master SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: 39c347e0b8ba5c8bfbecd719d0ddc92042bd52a9, 94288382654c83b3cfaf587a6932e6f3f753386d
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack, fixture graph check (kit-app, effect-app): identical before/after
- PRs: