---
satisfies: [R6]
---
# fn-7-native-atoms-modeled-on-effect-atom.5 Showcase-kit atoms demo, Atoms guide, ADR 0008, CONTEXT

## Description
Showcase and docs:
- Replace the hand-rolled `ReactiveStore` in `apps/showcase-kit/src/client/component-services.ts` with kit atoms (keeping the behavior), or add an atoms panel; add tests.
- apps/docs: an `atoms.mdx` guide whose code comes only from snippet includes, added to `meta.json` and to `guides.test.ts`'s scope; the reference is covered automatically.
- ADR 0008 (native atoms over depending on effect-atom), plus a row in `docs/adr/README.md`.
- CONTEXT.md: Atom, AtomStore and Result.
- A line in the root README, and a React README section.

Touches: apps/showcase-kit/src/**, apps/showcase-kit/src/__tests__/**, apps/docs/content/docs/atoms.mdx, apps/docs/content/docs/meta.json, apps/docs/snippets/atoms*, apps/docs/test/guides.test.ts, docs/adr/0008-*.md, docs/adr/README.md, CONTEXT.md, README.md, packages/react/README.md

## Acceptance
- [ ] The showcase-kit tests (including e2e) pass with atoms in use.
- [ ] `pnpm --filter docs build && pnpm --filter docs test` pass, with the Atoms guide present and every snippet typechecked.
- [ ] ADR 0008 is indexed. CONTEXT.md defines Atom, AtomStore and Result, and the stale-phrase test passes.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
