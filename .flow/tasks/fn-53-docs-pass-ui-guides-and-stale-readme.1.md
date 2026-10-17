---
satisfies: [R1, R2, R3, R4, R5, R6, R7]
---
# fn-53-docs-pass-ui-guides-and-stale-readme.1 ui guides, typed DOM/lazy/transition/portal pages and README refresh

## Description
Audit then write: docs-site ui guide and feature pages (R1-R3) with typechecked snippets in apps/docs/snippets, meta.json order, showcase page links; README refresh for the root and every package (R4), CONTEXT.md consistency (R5). Read each package's src/index.ts to make the export tables exact. **Touches:** apps/docs/**, README.md, packages/*/README.md, CONTEXT.md

## Acceptance
- R1-R7 hold
- pnpm turbo run test typecheck --filter=docs green; pnpm --filter docs build passes the link check

## Done summary
Added the @sleekstack/ui guide (ui.mdx: components, hooks, slot rule, event closures, keys, mount/hydrateMount/streaming/resume, each with its ADR) and four feature pages (typed-dom, lazy, transitions, portal-boundary) backed by typechecked snippets in apps/docs/snippets/ui; ordered them in meta.json and linked them from the showcase page and index. Refreshed the root README (no MVP spike, query no longer planned, every package listed), gave the ui README a row for every src/index.ts export (JSX props in their own table), dropped "MVP" from CONTEXT.md and errors.mdx, and listed every slot hook under ConditionalSlot/SlotMismatch. Kept and verified the dead worker's snippet drafts; split the resume snippet so the client entry imports no handler (review finding).

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> 1 re-review SHIP)
Gates: pnpm turbo run test typecheck --filter=docs green (37 tests); pnpm --filter docs build green with check:links ok; no generated api/*.md, pnpm-lock.yaml or apps/bench change.
Baseline: red pre-edit only from the dead worker's unincluded snippets/ui drafts (guides "include every snippet file"); green after.
Follow-up: "shell" (stream first chunk) and React "Suspense" remain in READMEs in their non-CONTEXT senses.
## Evidence
- Commits: d5ec29aef3c6c1d5c3dbcfbd231fbc7fd00a9779, b3385042d51b4a6bd831eb432ccd202e494d50b4
- Tests: pnpm turbo run test typecheck --filter=docs, pnpm --filter docs build
- PRs: