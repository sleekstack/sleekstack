---
satisfies: [R1, R2]
---
# fn-59-docs-build-platform-on-ui-and-start.3 ui-vite: new package, MDX compile pipeline with build-time highlighting

## Description
Create the Vite plugin package of fn-29 (`@sleekstack/ui-vite`) and its first piece: compile an MDX page to a ui component that exports its frontmatter, with the plugins the D2 probe found necessary.

**Size:** M
**Files:** new packages/ui-vite/ (package.json, tsconfig*.json, src/index.ts, src/mdx.ts, src/include.ts, src/highlight.ts, src/__tests__/*, README.md); pnpm-lock.yaml
**Touches:** [packages/ui-vite/**, pnpm-workspace.yaml, pnpm-lock.yaml]

### Approach
- Compile with `@mdx-js/mdx` 3.1.1 and `jsxImportSource: '@sleekstack/ui'`, `elementAttributeNameCase: 'html'`, `tableCellAlignToStyle: false`; remark: frontmatter and its export, GitHub tables; a small remark plugin that expands the guides' `<include>` tag into a code block read from the named file (missing file fails naming the page and path); rehype: heading ids (rehype-slug) and build-time highlighting (shiki through its rehype plugin), then a pass that turns highlighter inline styles into classes and collects one stylesheet (ui renders style objects as `[object Object]`).
- Package layout copies `packages/router` (type module, `sideEffects: false`); dependencies are the MDX and shiki packages only, no React.
- Pages come from the chart record for the probe: `.flow/charts/fn-57/2.md` and its answer file.
- Test against real pages from `apps/docs/content/docs`: every guide and the generated API pages compile and render with `renderToString`; an unknown fence language is reported; invalid MDX fails naming file and line.
- Check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries.

### Investigation targets
**Required**:
- `.flow/charts/fn-57/2.json` (the probe's findings and versions)
- `packages/router/package.json`, `tsconfig*.json` (package shape)
- `apps/docs/content/docs/*.mdx` (include tags, tables, code), `apps/docs/snippets/`
- `.flow/specs/fn-29-sleekstack-vite-plugin.md`
- `packages/ui/src/jsx-runtime.ts` (what the compiled output is)
**Optional**:
- `apps/docs/scripts/generate-api.mjs` (the generated API pages' format)

## Acceptance
- [ ] All current guides and generated API pages compile and `renderToString` to HTML with tables, links, lists, inline code and heading ids
- [ ] Code blocks are highlighted at build time with classes and one stylesheet; no style object leaks into an attribute
- [ ] Invalid MDX, a missing include file and an unknown fence language each fail or report with the file (and line where known)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` is green

## Done summary
New @sleekstack/ui-vite with compileMdx (MDX to ui JSX runtime, frontmatter, GFM, rehype-slug, include tag, build-time shiki with style-to-class and one stylesheet). 26 guides plus 13 generated API pages compile and render.

baseline: none (new package)
stage: impl-review - skipped(policy: user standing rule, no per-task review)
GATE_SKIPPED:none
## Evidence
- Commits: fc627827b02980d5923c27269ff7d3082eb8690b
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui-vite..., pnpm format:check
- PRs: