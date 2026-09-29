---
satisfies: [R5]
---
# fn-11-effect-first-runtime-graph-and-devtools.7 docs: ADR 0010, CONTEXT, READMEs, apps/docs, migration note

## Description
Record the decision and update every place that attributes action/query to `@sleekstack/next`. Sequence after fn-9.8 to avoid conflicts.

**Size:** S
**Files:** docs/adr/0010-*.md, docs/adr/README.md, CONTEXT.md, README.md, packages/next/README.md, packages/kit/README.md, packages/devtools/README.md, apps/docs/content/docs/{index,getting-started-effect,errors,nextjs}.mdx, apps/docs/snippets/effect/next.ts, apps/docs/snippets/kit/next.ts
**Touches:** [docs/**, CONTEXT.md, README.md, packages/*/README.md, apps/docs/**]

### Approach
- ADR 0010 supersedes the action/query part of the next adapter decisions (ADR 0009 stays).
- CONTEXT.md:92-100 (Request Scope, Action, Query) re-attributed; add Devtools term.
- Docs Next snippets keep `'use server'` wrappers around kit `action()` (memory pitfall).
- Migration note: prose only, no codemod.

## Acceptance
- [ ] No doc attributes action/query to @sleekstack/next
- [ ] ADR 0010 and index entry exist
- [ ] apps/docs builds

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
