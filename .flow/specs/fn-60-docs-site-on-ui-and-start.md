## Conversation Evidence

- [user] "rebuild the docs site ... as a SleekStack ui app served by @sleekstack/start" (chart fn-57 outcome)
- [user] Look: "Reproduce the current layout and behavior, plain CSS" (D8)
- [user] Versioning: "One version now, designed to add versions later" (D9)
- [user] Languages: "English only now, routes ready for locales later" (D10)
- [user] Analytics: "None, nothing tracked" (D11); edit-on-GitHub links: out of scope
- [paraphrase] Evidence from the resolved decisions: fumadocs features inventory (D1), which tests and scripts carry over (D3), the API reference pipeline and fn-34 (D4). Source: chart fn-57, briefing B1, cluster 2.

## Goal & Context
<!-- scope: business -->

The docs site (Next 15 with fumadocs) becomes a SleekStack ui app on the build platform of the companion spec, with no dependency on kit, react, next, islands or fumadocs. When it lands, the four React and Next packages can be deleted. [paraphrase]

The site keeps today's layout and behavior, written as a small hand-made stylesheet; it is not a redesign. [user]

## Architecture & Data Models
<!-- scope: technical -->

- **Content.** The guides stay MDX files in one directory with one order file; the generated API pages are still produced by TypeDoc into a gitignored tree. [paraphrase]
- **Layout components (ui).** Sidebar built from the order file with collapse and a mobile drawer, light and dark theme with a switcher, previous and next page footer, and prose styling for tables, inline code, code blocks and blockquotes, in plain CSS with no Tailwind and no fumadocs CSS. [user]
- **Search dialog.** A cmd-K dialog over the build-time index from the platform spec. Today's dialog is an Orama index behind a Next route, and it is the only thing behind that dialog. [paraphrase]
- **API reference.** Generation and the coverage check do not depend on fumadocs and stay. The list of documented packages drops next, react and kit and adds ui and start (this folds the open ui API reference spec, fn-34, into this work); ui's `jsx-dev-runtime` entry is filtered out. [paraphrase]
- **Tests and scripts.** All are content-level and carry over: stale phrases, link checker, benchmarks page, API coverage. The guides test needs the `<include>` handling and a rewritten scope list; the examples test needs the TypeScript config changed (Next plugin removed, ui JSX settings added) and its kit `@example` cases pointed at ui and start or dropped. The `dev`, `build` and `typecheck` scripts, and the fumadocs, Next, Tailwind and PostCSS dependencies, go. [paraphrase]
- **Snippets.** 27 of the 59 snippet imports come from packages being deleted (kit 18, react 5, next 3, islands 1). They are rewritten against core, ui, router and start, or removed together with their pages. [paraphrase]
- **Routes.** Pages live under a configurable base prefix so a version or locale prefix can be added later without moving pages; English only for now. [user]

## API Contracts
<!-- scope: technical -->

- **Pages:** `/docs/<slug>` stays the URL shape, with heading ids from github-slugger so existing anchors keep working. [paraphrase]
- **Order file:** the existing format (a title and an ordered list, with the API folder pulled in as the last entry). [paraphrase]
- **Search:** the client function and index format of the platform spec. [paraphrase]

## Edge Cases & Constraints
<!-- scope: technical -->

- Without JavaScript the content is readable as static HTML; theme switcher, drawer and search need JavaScript. [inferred]
- The theme follows the system setting by default and remembers an explicit choice; the page must not flash the wrong theme on load. [inferred]
- Every internal link and anchor in the migrated pages must resolve; the link checker fails the build otherwise. [paraphrase]
- The docs site must not import the four packages being deleted, which is the precondition of the removal spec's deletion task (fn-55 task 6). [paraphrase]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The site builds to static pages with the platform: every remaining guide and API page renders, the sidebar follows the order file, and every internal link and anchor resolves. Errors: a broken link or anchor fails the build naming source and target. [paraphrase]
- **R2:** The layout matches today's behavior in plain CSS: sidebar with collapse and a mobile drawer, light and dark theme with a switcher (system default, remembered choice, no flash), previous and next footer, and prose styling for tables, code and blockquotes, with no Tailwind and no fumadocs CSS. Errors: with JavaScript off the content stays readable. [user]
- **R3:** The cmd-K dialog searches the build-time index, is keyboard accessible, and shows a message for no results. Errors: if the index fails to load, the dialog shows an error instead of staying blank. [user]
- **R4:** The API reference is generated for core, runtime, query, ui, start and the other surviving packages, not for next, react or kit; `jsx-dev-runtime` is not a page; the coverage test requires a TSDoc summary for every export. Errors: an undocumented export fails the coverage test. [paraphrase]
- **R5:** Pages and snippets about kit, react, next and islands are deleted; the snippets that remain are rewritten against core, ui, router and start and typecheck in the examples test; the stale-phrase test passes. Errors: a snippet that does not typecheck fails the examples test. [paraphrase]
- **R6:** The five tests and the scripts keep their intent on the new site, `dev`, `build` and `typecheck` run without Next or fumadocs, and the docs checks pass. Errors: no error surface beyond R1 to R5. [paraphrase]
- **R7:** Pages live under a configurable base prefix, no code assumes a single prefix, the site is English only and nothing is tracked. Errors: a build with a different prefix still passes the link checker. [user]
- **R8:** `apps/docs` depends on none of kit, react, next, islands, fumadocs, Next, Tailwind or PostCSS; a repo search of `apps/docs` for the four package names finds nothing (checked with a positive control first). Errors: any remaining reference fails the check. [paraphrase]
- **R9:** Records are updated: an ADR for the docs site on ui and start, the docs README, CONTEXT and AGENTS.md; the removal spec's deletion task (fn-55 task 6) can then run, and the removal spec's docs-content task is reconciled with this one. Errors: no error surface beyond the checks in R1 to R8. [paraphrase]

## Boundaries
<!-- scope: business -->

- No new visual design, no Tailwind, no component library. [user]
- No versioned docs, translations, analytics, edit-on-GitHub links or Open Graph design work beyond what the platform spec generates. [user]
- The build platform (MDX build, head, routes, prerender, search index, Open Graph images) belongs to the companion spec. [paraphrase]
- Deleting the four packages themselves is the removal spec (fn-55), not this one. [paraphrase]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

The four React and Next packages cannot be deleted while the docs site imports them, and the site cannot stay on a stack the framework does not provide. Reproducing the current look keeps the rebuild at parity and leaves a design pass for later. [user]

### Implementation Tradeoffs
<!-- scope: technical -->

Rejected: a new design (needs design decisions and probably a design system first); keeping Tailwind and a fumadocs-like theme (keeps a styling tool as a dependency of a ui app); version, locale and analytics work now (none exists on the site today). Overlap to reconcile: the removal spec's docs-content task covers some of the same pages and records. [user]

Source: chart fn-57 decisions D1, D3, D4, D8, D9, D10, D11 and briefing B1 cluster 2.
