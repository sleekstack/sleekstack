---
satisfies: [R5]
---
# fn-60-docs-site-on-ui-and-start.2 docs content: rewrite the remaining pages and snippets that use the removed packages

## Description
Eight surviving pages and their snippets still use kit, the React adapter, the Next adapter or islands: index, agents, atoms, errors, getting-started-effect, queries, queries-ssr and tanstack-query. Rewrite each against core, runtime, ui, router, start and query so the snippets typecheck, or cut the passage when the thing it described is gone.

**Size:** M
**Files:** apps/docs/content/docs/index.mdx, agents.mdx, atoms.mdx, errors.mdx, getting-started-effect.mdx, queries.mdx, queries-ssr.mdx, tanstack-query.mdx; the snippets they include (atoms*.tsx, queries*.tsx, effect/, concepts/, errors/)
**Touches:** [apps/docs/content/docs/**, apps/docs/snippets/**]

### Approach
- 27 of the 59 snippet imports come from the packages being deleted (kit 18, react 5, next 3, islands 1): list them first with a search, then fix page by page.
- Use CONTEXT.md vocabulary and avoid the `_Avoid_` names (the stale test checks phrases); keep one idea per snippet and keep snippets typechecked in `apps/docs/snippets`.
- Where a page described the Next adapter's server operations, say what `@sleekstack/start` offers instead (server functions, ADR 0039); do not invent features.
- The examples test (`apps/docs/test/examples.test.ts`) typechecks the snippets against the docs tsconfig; run it.

### Investigation targets
**Required**:
- the eight pages and `apps/docs/snippets/` (grep for `@sleekstack/kit|react|next|islands`)
- `apps/docs/test/examples.test.ts`, `guides.test.ts`, `stale.test.ts`
- `CONTEXT.md`, `docs/adr/0039-*.md` (start), `packages/ui/README.md`, `packages/router/README.md`
**Optional**:
- `apps/showcase/src/` (working examples to adapt)

## Acceptance
- [ ] No page or snippet in `apps/docs/content` or `apps/docs/snippets` names kit, the React adapter, the Next adapter or islands as an import or a dependency (search with a positive control first)
- [ ] All remaining snippets typecheck; stale-phrase and link tests pass
- [ ] `pnpm turbo run test typecheck --filter=docs` is green

## Done summary
Rewrote the surviving docs pages (index, agents, atoms, errors, getting-started-effect, queries, queries-ssr, tanstack-query, concepts, side-effects, testing) and their snippets against core, ui and query; the Next and React server passages are cut or point at @sleekstack/start (ADR 0039). A search of content and snippets for kit, react, next and islands now finds nothing (it found 30+ hits before, as the positive control). guides.test.ts scope list rewritten.

stage: impl-review - skipped(policy: user standing rule, no per-task Codex review)
## Evidence
- Commits: a6e4553cb9c51414a617d554e80bc0ee587633c3
- Tests: pnpm turbo run test typecheck --filter=docs, pnpm format:check
- PRs: