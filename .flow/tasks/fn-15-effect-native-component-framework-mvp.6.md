---
satisfies: [R7]
---
# fn-15-effect-native-component-framework-mvp.6 ui demo app, fixtures per error code and docs

## Description
Add a runnable demo in `apps/` showing `UserCard` plus one fixture per Analyzer code, and the docs the new package and codes need (R7). Docs fold in here per the finalization rule.

**Size:** M
**Files:** `apps/ui-demo/` (package.json, vite config, src, fixtures, test), `CONTEXT.md`, `docs/adr/00NN-host-first-component-framework.md`, `docs/adr/README.md`, `apps/docs/content/docs/errors.mdx`, `apps/docs/content/docs/testing.mdx`, `README.md`, `packages/analyze/README.md`
**Touches:** [apps/ui-demo/**, CONTEXT.md, docs/adr/**, apps/docs/content/docs/**, README.md, packages/analyze/README.md, pnpm-lock.yaml]

## Approach
- Mirror `apps/playground` (Vite, private, `type: module`); add `"check": "sleekstack check"` and the `sleekstack` workspace devDep as `apps/showcase-kit/package.json` does. The app mounts `UserCard` with the DOM renderer.
- Error fixtures live in a separate folder outside the app's build, one file per code; a vitest test runs `analyzeComponents` on them and asserts each code (not the CLI's build output).
- ADR: next free number (fn-12 reserves 0014), shape of `docs/adr/0013-*.md`, records host-first choice, rejected options A/B, open decisions; add the index row.
- CONTEXT.md: Component, Host, Guest, Mount, Provide, Catch with `_Avoid_` lines; state the ui Component is unrelated to the `component` lifetime; extend the Analyzer entry.
- errors.mdx/testing.mdx: the four codes and the gated check. Snippets must compile (`apps/docs/test/examples.test.ts`) and links resolve. Do not add `ui` to `apps/docs/scripts/entry-points.mjs` (spike; avoids the API-coverage JSDoc gate).

## Investigation targets
**Required**:
- `apps/playground/package.json`, `apps/playground/vite.config.ts` — app shape (ignore untracked `.js` siblings)
- `apps/showcase-kit/package.json` — check script wiring
- `docs/adr/0013-framework-agnostic-runtime-package.md`, `docs/adr/README.md`
- `CONTEXT.md` — term format
- `apps/docs/content/docs/errors.mdx:12-23`


## Acceptance
- [ ] `pnpm --filter ui-demo dev` serves `UserCard`; `build` succeeds (R7).
- [ ] One fixture per code, each asserted by the demo's test (R7).
- [ ] ADR, index row, CONTEXT.md terms, errors/testing docs and READMEs updated.
- [ ] `pnpm --filter docs test` passes.

## Done summary
Added apps/ui-demo (Vite app mounting the canonical UserCard with the DOM renderer, `check` script), four fixtures (one per Analyzer code) asserted by vitest with exact file:line, and the docs: ADR 0015 + index row, CONTEXT.md ui terms (Component, Host, Guest, Mount, Provide, Catch) and Analyzer extension, errors.mdx component-errors table, testing.mdx gated check, root/analyze/ui READMEs (ui README now lists mount and Mounted).

Tier: session (jev-unavailable(no_key))
stage: impl-review - ran (codex fan-out, 3 draws SHIP, 0 findings)
Note: baseline not run pre-edit (task is additive: new app + docs); post-edit Quick commands, ui-demo test/build/typecheck/check, and docs test all green.
## Evidence
- Commits: b40eb14eba57d145d86c782fd4791876bf033dd6
- Tests: pnpm --filter ui-demo test && pnpm --filter ui-demo build && pnpm --filter ui-demo typecheck && pnpm --filter ui-demo check, pnpm --filter docs test, pnpm --filter @sleekstack/ui test && pnpm --filter @sleekstack/ui typecheck && pnpm --filter @sleekstack/analyze test && pnpm --filter sleekstack test
- PRs: