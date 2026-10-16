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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
