---
satisfies: [R7]
---
# fn-24-pending-async-boundaries-for.7 docs: ADR 0015 Pending amendment, README, CONTEXT, queries page

## Description
Records Pending decisions and limits: keep-previous default, no timeout on renderToString, fallback must not suspend, nested-instance re-runs never show fallback, QueryFailed wrapper.

**Size:** S
**Files:** docs/adr/0015-host-first-component-framework.md, packages/ui/README.md, CONTEXT.md, apps/docs/content/docs/queries.mdx, apps/docs/content/docs/errors.mdx
**Touches:** [docs/adr/0015-host-first-component-framework.md, packages/ui/README.md, CONTEXT.md, apps/docs/content/docs/*.mdx]

### Approach
- Add `## Amendment: Pending boundaries` before `## Open decisions` (~l.63), mirroring fn-23's amendment.
- README: Pending and useSuspenseQuery in the JSX/State paragraphs (~l.24-26). CONTEXT: add a Pending term (do not call it a provider). Do not hand-edit generated api docs.

### Investigation targets
**Required** (read before coding):
- docs/adr/0015-host-first-component-framework.md amendments (~l.22-63)
- CONTEXT.md Query entry (~l.205)

## Acceptance
- [ ] ADR amendment, README and CONTEXT define Pending and its limits (R7).
- [ ] `pnpm turbo run test typecheck --filter=docs` green.

## Done summary
Documented Pending and useSuspenseQuery as built: ADR 0015 amendment (keep-previous, error routing incl. Boundary-replaces-old-content, nested re-run never shows fallback, renderToString awaits with no fallback/timeout, fallback must not suspend, QueryFailed with no runtime client error, analyzer id ui/pending#Pending), README rows + Async paragraph, CONTEXT Pending term, queries.mdx and errors.mdx.

baseline: green via handoff (verified at a346439 by fn-24.6)
stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: implementer: opus at medium (project routing block)
## Evidence
- Commits: 4012904f7c8015d5df1a82c1abdd7495d0412ce9
- Tests: pnpm turbo run test typecheck --filter=docs --filter=@sleekstack/ui...
- PRs: