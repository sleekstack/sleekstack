# fn-57 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-57 - Rebuild the docs site on ui and start
**Chart status:** done

## Outcome

apps/docs becomes a SleekStack ui app served by @sleekstack/start with no dependency on kit, react, next, islands or fumadocs, keeping every page, snippet test and navigation (and search if wanted), so the four packages can be deleted.

## Notes

- apps/docs is Next 15 with fumadocs-core and fumadocs-ui 15.8.5 and fumadocs-mdx 12.0.3 [ref: apps/docs/package.json]
- 28 MDX pages in content/docs plus a generated api/ tree that is gitignored [ref: apps/docs/content/docs]
- No custom React components were found in the MDX pages by search [ref: apps/docs/content/docs]
- Scripts: generate-api, check-links, generate-benchmarks, entry-points [ref: apps/docs/scripts]
- Five docs tests: api-coverage, examples, guides, links, stale [ref: apps/docs/test]
- 35 docs files import the four packages being removed: 12 pages, 14 snippets and 1 test among them [ref: repo search on the fn-55 branch]
- Open specs with no tasks: fn-29 Vite plugin, fn-30 static generation, fn-31 HMR, fn-33 head, fn-34 ui API reference in the docs site [ref: .flow/specs]
- @sleekstack/start is on master with a fetch entry and server functions but no static generation [ref: PR 85, docs/adr/0039-start-server-core.md]

## Decisions

- **fn-57.D1:** Which fumadocs features does the site use? - Inventory at revision 4780eb0 (branch chart-docs-rebuild). All paths under apps/docs. Versions: fumadocs-core 15.8.5,... - [record](.flow/charts/fn-57/1.md)
- **fn-57.D2:** Can MDX compile to the ui JSX runtime? - Yes. MDX compiles to the @sleekstack/ui JSX runtime with no changes to ui. All 27 hand-written pages and the 13 gener... - [record](.flow/charts/fn-57/2.md)
- **fn-57.D3:** Which docs tests and scripts carry over? - Probe: `pnpm --filter docs test` passes today, 6 files and 37 tests (the pretest hook regenerated the gitignored api... - [record](.flow/charts/fn-57/3.md)
- **fn-57.D4:** How is the generated API reference consumed? - Pipeline (all paths under apps/docs): - [record](.flow/charts/fn-57/4.md)
- **fn-57.D5:** Is search needed at launch, and what kind? - Search is required at launch, as a static index built at build time and searched in the browser. The build writes a s... - [record](.flow/charts/fn-57/5.md)
- **fn-57.D6:** Sequencing against fn-29, fn-30 and fn-33 - The docs rebuild is the first user of the Vite plugin, head management and static generation (open specs fn-29, fn-33... - [record](.flow/charts/fn-57/6.md)
- **fn-57.D7:** Hosting: static build or running start server? - The docs ship as a static site: production is prerendered HTML plus a client bundle, hostable on any static host or C... - [record](.flow/charts/fn-57/7.md)
- **fn-57.D8:** Visual design: reproduce or new? - Reproduce the current layout and behavior with a small hand-made stylesheet: sidebar from meta.json with collapse and... - [record](.flow/charts/fn-57/8.md)
- **fn-57.D9:** Versioned documentation: scheme and scope - Ship the docs as the only version for now, with routes and the build laid out so a version prefix such as /docs/v1/ c... - [record](.flow/charts/fn-57/9.md)
- **fn-57.D10:** Internationalization: languages and workflow - Ship English only, with routes laid out so a locale prefix such as /en/docs/ can be added later without moving pages.... - [record](.flow/charts/fn-57/10.md)
- **fn-57.D11:** Analytics: what to measure and how - No analytics: nothing is tracked on the site today and none will be added, so there is no script, no cookies, no cons... - [record](.flow/charts/fn-57/11.md)
- **fn-57.D12:** Open Graph images: generation approach - Use satori (layout to SVG) plus @resvg/resvg-js (SVG to PNG), run as a build step over the page list, with a plain ob... - [record](.flow/charts/fn-57/12.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Inventory at revision 4780eb0 (branch chart-docs-rebuild). All paths under apps/docs. Versions: fumadocs-core 15.8.5,... -- [record](.flow/charts/fn-57/1.md)
- **D2:** Yes. MDX compiles to the @sleekstack/ui JSX runtime with no changes to ui. All 27 hand-written pages and the 13 gener... -- [record](.flow/charts/fn-57/2.md)
- **D3:** Probe: `pnpm --filter docs test` passes today, 6 files and 37 tests (the pretest hook regenerated the gitignored api... -- [record](.flow/charts/fn-57/3.md)
- **D4:** Pipeline (all paths under apps/docs): -- [record](.flow/charts/fn-57/4.md)
- **D5:** Search is required at launch, as a static index built at build time and searched in the browser. The build writes a s... -- [record](.flow/charts/fn-57/5.md)
- **D6:** The docs rebuild is the first user of the Vite plugin, head management and static generation (open specs fn-29, fn-33... -- [record](.flow/charts/fn-57/6.md)
- **D7:** The docs ship as a static site: production is prerendered HTML plus a client bundle, hostable on any static host or C... -- [record](.flow/charts/fn-57/7.md)
- **D8:** Reproduce the current layout and behavior with a small hand-made stylesheet: sidebar from meta.json with collapse and... -- [record](.flow/charts/fn-57/8.md)
- **D9:** Ship the docs as the only version for now, with routes and the build laid out so a version prefix such as /docs/v1/ c... -- [record](.flow/charts/fn-57/9.md)
- **D10:** Ship English only, with routes laid out so a locale prefix such as /en/docs/ can be added later without moving pages.... -- [record](.flow/charts/fn-57/10.md)
- **D11:** No analytics: nothing is tracked on the site today and none will be added, so there is no script, no cookies, no cons... -- [record](.flow/charts/fn-57/11.md)
- **D12:** Use satori (layout to SVG) plus @resvg/resvg-js (SVG to PNG), run as a build step over the page list, with a plain ob... -- [record](.flow/charts/fn-57/12.md)

## Boundaries

(none)

## Assets

(none)

## Clusters

- **cluster 1:** Docs build platform: the build and publish machinery the site needs, built as the real Vite plugin, head management and static generation pieces (MDX build step, per-page titles and Open Graph tags, route generation, static prerender, build-time search index, ui void-element fix) - decisions: fn-57.D2, fn-57.D5, fn-57.D6, fn-57.D7, fn-57.D12
- **cluster 2:** Docs site on the platform: layout in plain CSS, the guides and generated API pages, tests and scripts carried over, English only and version-ready routes, no analytics, then removal of the four packages - decisions: fn-57.D1, fn-57.D3, fn-57.D4, fn-57.D8, fn-57.D9, fn-57.D10, fn-57.D11

## Shared context

- fn-57.D6
