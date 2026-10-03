---
satisfies: [R7]
---
# fn-16-query-layer-follow-ups-kit-ssr-prefetch.5 docs: kit prefetch, server useMutation, new codes, lazy-read contract, CONTEXT terms

## Description
Finalization task: docs, CONTEXT.md and the errors page.

**Size:** S
**Files:** apps/docs/content/docs (nextjs.mdx, kit-vs-effect.mdx, errors.mdx), CONTEXT.md, apps/showcase-kit/README.md, packages/kit/README.md
**Touches:** [apps/docs/content/**, CONTEXT.md, apps/showcase-kit/README.md, packages/kit/README.md]

### Approach
- Do not hand-edit generated `apps/docs/.../api/*.md` (built by `prebuild: generate:api`).
- Document the lazy server read contract (item 4) in the kit prefetch page.
- Next snippets using `action()` need `'use server'` wrappers (memory: docs-next-snippets-need-use-server).
- Check TypeDoc anchors vs Fumadocs heading ids when linking (memory).

## Acceptance
- [ ] docs build and link check pass
- [ ] CONTEXT.md names the kit facade terms and the new codes

## Done summary
Documented the kit query SSR facade (prefetch, HydrateQueries, serializable/QueryCodec, lazy server read contract, server runner replacement), server useMutation (idle; MutateDuringRender), new kit codes QueryDecodeFailed/NoServerRunner/InvalidQueryKey, and optimistic rebase on refetch across queries-ssr, queries, errors, nextjs, kit-vs-effect, CONTEXT.md (QueryCodec, Server Runner terms), and both READMEs. Outside declared Touches (needed for docs tests/build to pass, which were red from fn-16.1/.4): apps/docs/snippets/kit/queries-ssr.tsx (new), apps/docs/snippets/errors/handle.ts (exhaustive code map), and JSDoc-only fixes in packages/kit/src/next/prefetch.ts and packages/kit/src/react/index.ts (self-contained @examples; NO_RUNNER const moved so useQuery keeps its doc summary).

Tier: opus at medium
stage: impl-review - ran (codex: fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: bfb80f694d38ddf2e11525f3817064397b2baaa5, 8bb8a05d83606f521409734da4d210a12675ca43
- Tests: cd apps/docs && pnpm test, cd apps/docs && pnpm build, pnpm typecheck && pnpm test, pnpm turbo run test typecheck --filter=@sleekstack/kit --filter=@sleekstack/query --filter=@sleekstack/react
- PRs: