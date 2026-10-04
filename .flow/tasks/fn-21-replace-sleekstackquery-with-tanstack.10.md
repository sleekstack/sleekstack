---
satisfies: [R11]
---
# fn-21-replace-sleekstackquery-with-tanstack.10 docs: rewrite the queries guide and snippets

## Description
Rewrite the docs for the new engine (R11, docs part).

**Size:** S
**Files:** `apps/docs/content/docs/queries.mdx`, `apps/docs/snippets/queries*.tsx`, `apps/docs/package.json`, `apps/docs/test/guides.test.ts` if it lists these, `README.md`
**Touches:** [apps/docs/content/docs/queries.mdx, apps/docs/snippets/queries.tsx, apps/docs/snippets/queries-effect.tsx, apps/docs/snippets/queries-ssr.tsx, apps/docs/package.json, apps/docs/test/guides.test.ts, README.md, pnpm-lock.yaml]

### Approach
- Guide covers: `QueryClientLive` in the layer, `QueryProvider` + react-query hooks, `effectFn` for Effect bodies, `prefetchQueries` + `HydrationBoundary`, kit queries, and the ui hooks from `@sleekstack/ui/query`; state the deliberate losses (no Effect-typed query errors).
- Snippets must compile: docs tests typecheck them (`apps/docs/test/guides.test.ts`); keep the file names the guide imports, and update `meta.json` only if a page is added or removed.
- Update the root `README.md` mention.

### Investigation targets
**Required**:
- `apps/docs/content/docs/queries.mdx`, `apps/docs/snippets/queries*.tsx`, `apps/docs/test/guides.test.ts`

### Key context
The docs API reference is generated; do not hand-edit generated output.

## Acceptance
- [ ] The queries guide and snippets describe and use the new engine and compile in the docs tests
- [ ] No mention of the removed engine API (`Query.make`, `Hydrate`, `QueryEvents`) remains in `apps/docs` or the root README
- [ ] `pnpm --filter docs test` (the docs app's test script) passes

## Done summary
Queries, queries-ssr and tanstack-query guides rewritten for QueryClientLive/QueryProvider/effectFn/prefetchQueries/HydrationBoundary, kit and ui hooks; snippets compile; kit SSR snippet removed; stale HydrateQueries/Hydrate mentions fixed in nextjs/atoms/showcases/kit-vs-effect. Root README only lists the package name, unchanged.
## Evidence
- Commits: 3b1292f
- Tests: pnpm --filter docs test, pnpm --filter docs typecheck
- PRs: