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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
