# Docs site (apps/docs) with generated API reference + refresh all docs

## Overview
Turn `apps/docs` into the SleekStack documentation site: a Next.js app on Fumadocs, with an API reference generated from TSDoc comments in `@sleekstack/core`, `next`, `react` and `kit` (TypeDoc feeding Fumadocs), plus hand-written guides. Bring every existing doc up to date with what has shipped: kit, `effect()`, enforced module privacy and pnpm 11. Depends on fn-5 (PR #6), so `effect()` is on master.

## Quick commands
```bash
pnpm --filter docs build            # generates the API reference, then next build
pnpm --filter docs test             # link check + API coverage check
pnpm --filter docs dev              # manual: open http://localhost:3000
```

## Scope
- `apps/docs`: a Next.js 15 App Router site on Fumadocs (fumadocs-core/ui/mdx), with local search.
- API reference generated at build time from each package's public entry points (`packages/*/src/index.ts`, and the kit `next`/`react` subpaths). Generated pages are build output, not committed.
- TSDoc on every public export of core, next, react and kit: a summary, `@param`, `@returns`, `@throws` (the error codes) and one `@example`, where missing.
- Guides (MDX): Introduction; Getting started (kit), Getting started (Effect); Concepts (Tag, Layer, Service, Module, lifetimes, Scope, Shadowing, privacy, graph); kit vs Effect-native; Next.js (actions, queries, runtime); React (LayerProvider, hooks, StrictMode); Side effects (`effect()`); Errors (each code and what triggers it); Testing; Showcases.
- Refresh existing docs: the root README (status, packages, a kit quick example, a link to the docs site), CONTEXT.md (effect, privacy), the ADR index (a table of 0001–0006 with status), the package READMEs (add a short README to core, next and react pointing at the site), the app READMEs, and `packages/cli/README.md` if stale.
- CI: build and test the docs site.

## Boundaries / non-goals
- No hosting or deployment (Vercel setup is later).
- No versioned docs, no i18n.
- No API changes; TSDoc and comments only in the packages.
- No hand-written API reference pages (they are generated).

## Decision context
- Fumadocs was chosen over Nextra and Docusaurus: it's App Router-native, matches the repo's Next 15 stack, and has a TypeDoc integration.
- Generated reference over hand-written: the reference can't drift from the code, and the guides carry the narrative.
- Rejected: TypeDoc-only (no guides) and MDX-only (goes stale).

## Acceptance Criteria
- **R1:** `apps/docs` builds with `next build`, and the dev server serves the guides and the API reference with working search and navigation. Errors: the build fails on an MDX compile error or a broken internal link.
- **R2:** The API reference covers every public export of `@sleekstack/core`, `@sleekstack/next`, `@sleekstack/react`, `@sleekstack/kit`, `@sleekstack/kit/next` and `@sleekstack/kit/react`, one page per package entry point with each symbol's signature and TSDoc. Errors: a coverage test lists each entry point's exports (TS compiler API) and fails if any export has no reference entry or an empty summary.
- **R3:** Every public export has a TSDoc summary, and functions document `@throws` with their error codes and at least one `@example`. Errors: the R2 coverage test fails on an empty summary; `@example` blocks in kit compile (a typecheck of extracted examples, or snippet files included by MDX).
- **R4:** The guides listed in Scope exist, with every code sample taken from typechecked snippet files (or from showcase sources), not inline-only code. Errors: the snippet typecheck fails on API drift.
- **R5:** The existing docs are updated: the root README, CONTEXT.md, an ADR index, READMEs for core/next/react (new, short), kit/app/cli READMEs, and nothing still claims privacy is descriptive-only, pnpm 10, or a missing kit/effect. Errors: a grep check in the docs test fails on the stale phrases ("descriptive graph metadata only", "pnpm 10", "pnpm@10").
- **R6:** CI builds and tests the docs site. Errors: CI fails if the docs build or test fails.

## Early proof point
Task .1 proves the TypeDoc-to-Fumadocs pipeline renders the kit reference inside a Next build. If the integration fails under Next 15 or the workspace setup, fall back to TypeDoc markdown output rendered as MDX pages before .2.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | site builds and serves | TBD | — |
| R2 | generated reference, full coverage | TBD | — |
| R3 | TSDoc completeness | TBD | — |
| R4 | guides with typechecked samples | TBD | — |
| R5 | existing docs refreshed | TBD | — |
| R6 | CI | TBD | — |
