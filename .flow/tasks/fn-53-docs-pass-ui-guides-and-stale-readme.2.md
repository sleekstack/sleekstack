---
satisfies: [R8]
---
# fn-53-docs-pass-ui-guides-and-stale-readme.2 Full Model/Draft guide in models.mdx

## Description
Rewrite apps/docs/content/docs/models.mdx into the full guide per R8, with typechecked snippets in apps/docs/snippets/models (reuse and extend profile.tsx; keep the docs tests passing), linked from the ui guide and showcases.mdx, and listed correctly in meta.json. Read ADR 0038, packages/core/src/model.ts, packages/ui/src/reactive.ts useDraft docs, apps/showcase/src/pages/model.tsx, apps/docs/test/guides.test.ts, and the ramcinpay-front guide (read-only). **Touches:** apps/docs/**

## Acceptance
- R8 holds; every rule links ADR 0038; snippets typecheck
- pnpm turbo run test typecheck --filter=docs green; pnpm --filter docs build link check passes

## Done summary
Rewrote models.mdx into the full Model/Draft guide (one idea + diagram, read side with ctx binding via a derived atom and useDerivedAtom, write side with strings-in/convert-in-toDto, useDraft atoms/source/limits, who calls toDto incl. useOptimistic apply, tests, checklist, common mistakes, not covered), each rule linking its ADR 0038 section. Snippets in apps/docs/snippets/models: UI-free profile.ts (ModelSpec + DraftSpec with toModel and diff), edit-profile/read/optimistic/limits components, directions.txt diagram, and spec-only plus component test examples (both test examples were run once under a temporary jsdom vitest config: 7/7 pass). ui.mdx and showcases.mdx already link /docs/models; meta.json order unchanged.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out, 3 draws SHIP, --base master)
Gates: pnpm turbo run test typecheck --filter=docs green (37 tests); pnpm --filter docs build green with check:links ok; no generated api/*.md, pnpm-lock.yaml or apps/bench change.
Baseline: green.
Note: the named reference apps/../ramcinpay-front/docs/agents/models-fromdto-todto.md does not exist; ported from ramcinpay ADR-0005/0006 and docs/agents/patterns.md instead.
## Evidence
- Commits: 4363362f7ccbdf4f21f7e96d57c12fe657f16d45
- Tests: pnpm turbo run test typecheck --filter=docs, pnpm --filter docs build
- PRs: