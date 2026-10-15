---
satisfies: [R2, R3, R4, R5, R6]
---
# fn-51-showcase-one-app-for-all-of-sleekstackui.2 Move CLI/analyzer fixtures, fix CI, docs tests and AGENTS.md

## Description
Replace the two Next.js app dependencies: re-point packages/cli check.test.ts and the analyzer fixtures to fixtures under packages/cli or packages/analyze covering the same cases; update AGENTS.md export-name rule, .github/workflows/ci.yml (drop deleted apps, build/bundle/e2e for showcase where they apply, the require-scripts list), apps/docs guides test and showcases.mdx, root and package READMEs that link the deleted apps. **Touches:** packages/cli/**, packages/analyze/**, .github/workflows/ci.yml, AGENTS.md, apps/docs/**, README.md, packages/*/README.md

## Acceptance
- R2, R3, R4, R5, R6 hold
- pnpm turbo run test typecheck for cli, analyze, docs green; grep finds no showcase-kit or ui-demo outside .flow/

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
