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
The showcase-kit DraftEditor draft is now a kit atom. The filter and selection store stays a plain store because ProjectView renders on the server and atoms are client only. This task added the Atoms guide (kit and Effect snippets, the sibling-sharing limit, sidebar, guides.test scope), ADR 0008 with its index row, the CONTEXT terms Atom, AtomStore and Result, a root README line and a React README section. It also fixed docs breakage left by earlier fn-7 tasks, all outside the declared Touches: the AtomCycle hint in snippets/errors/handle.ts, the useAtomValue overload TSDoc (a typedoc warning), and namespace exports (`Atom`, `Result`), which now get their own reference pages from generate-api.mjs and pass api-coverage.

Tier: implementer opus at medium
stage: impl-review - ran (codex gpt-6-astra high, fan-out 3/3 SHIP)
## Evidence
- Commits: f3f9e0aa0b4c1839a23e63f374302234b2ae73d3
- Tests: pnpm typecheck && pnpm test --force, pnpm --filter docs build, pnpm --filter docs test, pnpm --filter showcase-kit build && test:bundle && test:e2e
- PRs: