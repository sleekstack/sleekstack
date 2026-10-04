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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
