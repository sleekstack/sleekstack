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
Added apps/ui-demo/test/hydrate.test.ts (full App: renderToString, then hydrateMount; server nodes kept, payload script removed, no onError, a sort click re-renders). Documented the built behavior: ADR 0015 `## Amendment: hydration` (and fixed the "serializes once" and "ignore closures" lines), notes in ADR 0016/0017, a Hydrate Mount entry in CONTEXT.md (Hydrate dropped from Resume's _Avoid_), README rows, atoms.mdx and queries-ssr.mdx.

Outside Touches: the gate was red at base. apps/ui-demo/test/app.test.ts had four exact-string pins that broke on fn-25.1's `<!--sleek-t-->` separator. I updated them to the exact new output, with no weaker matchers. The BASELINE_HANDOFF "green" claim was wrong for ui-demo#test.

baseline: red (ui-demo#test app.test.ts, inherited from fn-25.1 separator)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: ef98864e63e12047b0599992a46dea7cd0609361
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo --filter=docs
- PRs: