---
satisfies: [R4, R6]
---
# fn-60-docs-site-on-ui-and-start.6 docs tests and scripts carry over, and the API reference covers the surviving packages

## Description
Keep the docs checks meaningful on the new site and bring the API reference in line: the package list, ui and start coverage, and the examples and guides tests.

**Size:** M
**Files:** apps/docs/scripts/entry-points.mjs, generate-api.mjs, check-links.mjs; apps/docs/test/api-coverage.test.ts, examples.test.ts, guides.test.ts, links.test.ts; TSDoc in packages/ui/src and packages/start/src where an export lacks a summary
**Touches:** [apps/docs/scripts/**, apps/docs/test/**, packages/ui/src/**, packages/start/src/**]

### Approach
- `PACKAGES` in `entry-points.mjs`: drop next, react and kit (and any package deleted by then), add ui and start; skip `./jsx-dev-runtime` (and `./internal`); this also covers the open ui API reference spec fn-34, which is superseded.
- `api-coverage.test.ts` requires a heading and a non-empty TSDoc summary per export: run it, then add TSDoc where ui or start exports lack a summary (this is the only package-code change allowed); delete its `next reference documents runEffect` case.
- `guides.test.ts`: keep `<include>` target checks if the platform still uses that tag (it does); rewrite its `scope` list for the remaining packages. `examples.test.ts`: tsconfig without the Next plugin and with ui JSX; point the kit `@example` checks at ui and start or drop them.
- `links.test.ts`, `stale.test.ts`, `benchmarks.test.ts` and their scripts: unchanged unless the platform changes route or id rules.
- Heading ids: the link checker's slugger and the MDX pipeline's ids stay in step (test).

### Investigation targets
**Required**:
- `apps/docs/scripts/entry-points.mjs`, `generate-api.mjs`, `check-links.mjs`
- `apps/docs/test/*.test.ts`
- `.flow/charts/fn-57/3.json`, `.flow/charts/fn-57/4.json` (the carry-over analysis and the API pipeline)
- `.flow/specs/fn-34-ui-api-reference-in-the-docs-site.md`
**Optional**:
- `packages/ui/package.json`, `packages/start/package.json` (exports)

## Acceptance
- [ ] The API reference generates pages for the surviving packages including ui and start, with no page for `jsx-dev-runtime` or `internal`; the coverage test passes with a TSDoc summary on every export
- [ ] The guides, examples, links, stale and benchmarks tests pass on the new site; the `next reference` case and the kit example cases are gone or retargeted
- [ ] fn-34 is recorded as superseded in the records task
- [ ] `pnpm turbo run test typecheck --filter=docs --filter=@sleekstack/ui... --filter=@sleekstack/start...` is green

## Done summary
API reference now covers core, runtime, query, ui and start (no jsx-dev-runtime/internal pages); TSDoc added to ui and start exports; examples.test typechecks ui/start @example blocks (two start examples made self-contained). Gaps from .5 closed: heading ids shared via ui-vite `headings` (underscores kept, check-links.mjs now wraps ui-vite), real-docs tests skip generated api/, `contentBase` + `rebase` rewrites /docs links to the configured base (tested with base /other), root index.html redirect, DEFAULT_SITE constant. fn-34 superseded (records task owns the note).
Drift for fn-60.7: packages/cli initAgents and the analyze llms test still read packages/kit/llms.md (not fixed here). ui-vite gained ./links and ./routes subpath exports and DocsOptions.contentBase.
stage: impl-review - skipped(config: standing user rule, per-task Codex review skipped)
## Evidence
- Commits: dcfc44590b2666290d9c6e0d8daf2ba5f3cde618
- Tests: pnpm turbo run test typecheck build --filter=docs..., pnpm format:check
- PRs: