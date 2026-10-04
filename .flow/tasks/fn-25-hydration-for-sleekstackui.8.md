---
satisfies: [R7]
---
# fn-25-hydration-for-sleekstackui.8 ui-demo hydrate test, ADR 0015 amendment, CONTEXT, README

## Description
End-to-end proof and docs. CONTEXT.md currently says _Avoid_: Hydrate for Resume; reword so the new name is allowed.

**Size:** S
**Files:** apps/ui-demo/test/hydrate.test.ts (new), docs/adr/0015-host-first-component-framework.md, docs/adr/0016-serializable-atoms-ssr.md, docs/adr/0017-resumable-host-first-components.md, CONTEXT.md, packages/ui/README.md, apps/docs/content/docs/atoms.mdx, apps/docs/content/docs/queries-ssr.mdx
**Touches:** [apps/ui-demo/test/hydrate.test.ts, docs/adr/**, CONTEXT.md, packages/ui/README.md, apps/docs/content/docs/*.mdx]

### Approach
- Model the test on apps/ui-demo/test/resume.test.ts: renderToString -> container.innerHTML -> hydrateMount.
- ADR 0015 `## Amendment: hydration` (also fix the l.32 and l.50 statements); ADR 0016/0017 notes; README table rows l.17-20; run `sleekstack check --json` before and after if a public name changed in kit.

### Investigation targets
**Required** (read before coding):
- apps/ui-demo/test/resume.test.ts
- CONTEXT.md l.141-149
- docs/adr/0015 l.22-63

## Acceptance
- [ ] ui-demo server-then-hydrate test passes (R7).
- [ ] Docs updated; `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo --filter=docs` green.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
