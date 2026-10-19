# fn-57 briefing B1 cluster 2

**Briefing:** B1
**Status:** final
**Cluster:** 2
**Rationale:** Docs site on the platform: layout in plain CSS, the guides and generated API pages, tests and scripts carried over, English only and version-ready routes, no analytics, then removal of the four packages
**Chart:** fn-57

## Outcome

apps/docs becomes a SleekStack ui app served by @sleekstack/start with no dependency on kit, react, next, islands or fumadocs, keeping every page, snippet test and navigation (and search if wanted), so the four packages can be deleted.

## Cluster decisions

- **fn-57.D1:** Which fumadocs features does the site use? - Inventory at revision 4780eb0 (branch chart-docs-rebuild). All paths under apps/docs. Versions: fumadocs-core 15.8.5,... - [record](.flow/charts/fn-57/1.md)
- **fn-57.D3:** Which docs tests and scripts carry over? - Probe: `pnpm --filter docs test` passes today, 6 files and 37 tests (the pretest hook regenerated the gitignored api... - [record](.flow/charts/fn-57/3.md)
- **fn-57.D4:** How is the generated API reference consumed? - Pipeline (all paths under apps/docs): - [record](.flow/charts/fn-57/4.md)
- **fn-57.D8:** Visual design: reproduce or new? - Reproduce the current layout and behavior with a small hand-made stylesheet: sidebar from meta.json with collapse and... - [record](.flow/charts/fn-57/8.md)
- **fn-57.D9:** Versioned documentation: scheme and scope - Ship the docs as the only version for now, with routes and the build laid out so a version prefix such as /docs/v1/ c... - [record](.flow/charts/fn-57/9.md)
- **fn-57.D10:** Internationalization: languages and workflow - Ship English only, with routes laid out so a locale prefix such as /en/docs/ can be added later without moving pages.... - [record](.flow/charts/fn-57/10.md)
- **fn-57.D11:** Analytics: what to measure and how - No analytics: nothing is tracked on the site today and none will be added, so there is no script, no cookies, no cons... - [record](.flow/charts/fn-57/11.md)

## Shared context

Shared-context D-IDs are attributable evidence for this cluster but are not duplicated acceptance requirements by default.

- **fn-57.D6:** Sequencing against fn-29, fn-30 and fn-33 - The docs rebuild is the first user of the Vite plugin, head management and static generation (open specs fn-29, fn-33... - [record](.flow/charts/fn-57/6.md)
