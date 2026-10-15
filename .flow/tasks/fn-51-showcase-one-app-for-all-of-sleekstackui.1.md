---
satisfies: [R1, R9]
---
# fn-51-showcase-one-app-for-all-of-sleekstackui.1 Rename ui-demo to showcase, delete the old apps

## Description
git mv apps/ui-demo apps/showcase after deleting the Next.js apps/showcase and apps/showcase-kit; package name `showcase`; fix workspace/lockfile, tsconfig paths, turbo filters, ADR 0022 and other doc paths that name apps/ui-demo. **Touches:** apps/**, pnpm-lock.yaml, docs/adr/**, README.md

## Acceptance
- R1 and R9 hold: one `showcase` package (former ui-demo), turbo test/typecheck/size green
- No reference to `apps/ui-demo` remains outside .flow/

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
