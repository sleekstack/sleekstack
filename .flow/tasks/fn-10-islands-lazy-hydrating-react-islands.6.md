---
satisfies: [R7]
---
# fn-10-islands-lazy-hydrating-react-islands.6 Docs: islands guide, ADR 0010, CONTEXT.md term, package README

Touches: apps/docs/content/docs/**, apps/docs/snippets/**, docs/adr/**, CONTEXT.md, packages/islands/README.md, apps/showcase-kit/README.md

## Description
Document the feature and record the decision.

**Size:** S
**Files:** apps/docs/content/docs/islands.mdx, apps/docs/content/docs/meta.json, apps/docs/snippets/islands.tsx, docs/adr/0010-islands-over-resumability.md, docs/adr/README.md, CONTEXT.md, packages/islands/README.md, apps/showcase-kit/README.md, apps/docs/content/docs/{showcases,nextjs,react}.mdx (cross-links)
**Touches:** apps/docs/**, docs/adr/**, CONTEXT.md, packages/islands/README.md

### Approach
- ADR: use the next free number (currently 0010; check `docs/adr` at write time, fn-9 may take it first). Cover islands over resumability, per-Island roots, app scope outside React, custom click replay limits.
- `islands.mdx` + `meta.json` entry + snippet; state the v1 limits from the spec's Edge Cases (`useId`, router context, HMR, `children`, per-Island atoms).
- CONTEXT.md term **Island** in the `**Term**:` / definition / `_Avoid_:` format (see `**LayerProvider**`).
- Run the docs tests (`apps/docs/test/{api-coverage,examples,guides,links,stale}.test.ts`) and fix what they demand.

### Investigation targets
**Required**:
- `CONTEXT.md:65` - term format
- `docs/adr/README.md` and `docs/adr/0009-next-internal-exit-hook.md` - ADR format
- `apps/docs/content/docs/meta.json` - page order

## Acceptance
- [ ] Docs page, snippet, meta entry, ADR with the next free number and README index line, CONTEXT.md term, package README
- [ ] v1 limitations listed in the docs page
- [ ] Docs tests pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
