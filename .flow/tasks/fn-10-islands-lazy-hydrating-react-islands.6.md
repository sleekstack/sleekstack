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
Islands docs: guide `islands.mdx` (sidebar after Atoms) with a three-file typed snippet (`apps/docs/snippets/islands/`), the v1 limits, ADR 0010 plus its index line, the CONTEXT.md term **Island**, the package README, a showcase-kit README row, and a Showcases cross-link. apps/docs now depends on `@sleekstack/islands` so the snippet typechecks, which changed pnpm-lock.yaml.

Review corrections: app scope is shared per `defineIslands` registry, not across the whole page. Component-scope `provide` must come from a client component because it cannot cross the RSC boundary. Server-render component scopes are closed by LayerProvider's parked-scope timeout (5 s), not left open. The ADR number 0010 may need bumping at merge if fn-9 adds an ADR.

stage: impl-review - ran (codex: fan-out 1 aborted by a commit before finalize, refunded; fan-out 2 NEEDS_WORK on the snippet's static import; round 3 SHIP)
Tier: opus at medium
## Evidence
- Commits: 871752ee4941b7aead5edfd73d566a4097345afb, 8a5ab8539b18cce2ee6106607c02930facee83ab, d72ba7ab27416fb39d332b2842522bada763c462
- Tests: pnpm --filter docs test, pnpm --filter docs typecheck, pnpm --filter @sleekstack/islands test, pnpm --filter @sleekstack/islands typecheck
- PRs: