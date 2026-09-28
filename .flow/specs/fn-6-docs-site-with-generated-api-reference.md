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
- `apps/docs`: a Next.js 15 App Router site on Fumadocs (fumadocs-core/ui/mdx), with local search. Greenfield (the directory holds only a placeholder README).
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

## Planning decisions (from research)
- **Versions:** Fumadocs 16.x requires Next 16 and React 19.2, so pin `fumadocs-core`/`fumadocs-ui` to `15.8.5` (peer range Next 14/15), plus the `fumadocs-mdx` release whose peer range accepts core 15.8.x. Use the workspace's Next 15 version (as in `apps/showcase-kit`). Tailwind v4.
- **API pipeline:** there is no native Fumadocs integration for TypeDoc, so the pipeline is `typedoc` 0.28 + `typedoc-plugin-markdown` 4.13, plus a small local step that injects a `title` into each page's frontmatter and rewrites `.md` links to site routes. It writes to `apps/docs/content/docs/api/` (gitignored). The script is `generate:api`, and `predev`/`prebuild`/`pretest` run it, so `dev` works on a clean checkout. Generation fails non-zero on TypeDoc errors (`treatWarningsAsErrors` or an equivalent flag).
- **Entry points:** the list is read from each package's `package.json` `exports` map where one exists (kit: `.`, `./next`, `./react`); otherwise from its `types` field (core/next: `src/index.ts`, react: `src/index.tsx`). A resolved file that is missing is a hard error. The generator and the R2 coverage test share one module that resolves this list, so it is never hand-maintained twice. Each entry point gets its own output directory (no collisions between index files).
- **Snippets:** `apps/docs/snippets/**/*.ts(x)` import the real `@sleekstack/*` workspace packages. `apps/docs` `typecheck` (`tsc --noEmit`) covers them. The MDX pages include them through Fumadocs' file-include (or a small remark include), never as inline-only code.
- **Link check in build:** `build` = `generate:api && next build && check:links`, so a broken internal link fails `pnpm --filter docs build`. The `test` script runs the same link check.
- **`test` script:** one vitest run with separate named tests for links, API coverage and stale phrases, so each check reports on its own. Test files are split per owner: `test/links.test.ts` + `test/api-coverage.test.ts` (.1, .2 extends), `test/guides.test.ts` (.3), `test/stale.test.ts` (.4). `typecheck` covers snippets and `@example` extraction.
- **ADR index:** a new `docs/adr/README.md`. A new ADR 0007 records the choice of Fumadocs plus the generated reference.
- **Stale spots** (from the scouts): `README.md:112` ("descriptive graph metadata"); the README "Planned Packages" section lists kit, which has shipped; `.claude/CLAUDE.md` names fn-1 as the active spec; core/next/react have no README; CONTEXT.md should say privacy is enforced. "pnpm 10" is already absent, and the grep keeps it that way.
- **CI:** add `apps/docs` to the hardcoded script-presence list at `.github/workflows/ci.yml:27-31`, and add docs build and test steps.

## Early proof point
Task .1 proves the TypeDoc-to-Fumadocs pipeline renders the kit reference inside a Next build. If the integration fails under Next 15 or the workspace setup, fall back to TypeDoc markdown output rendered as MDX pages before .2.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | site builds and serves | .1, .3 | — |
| R2 | generated reference, full coverage | .1, .2 | — |
| R3 | TSDoc completeness | .2 | — |
| R4 | guides with typechecked samples | .3 | — |
| R5 | existing docs refreshed | .4 | — |
| R6 | CI | .4 | — |
