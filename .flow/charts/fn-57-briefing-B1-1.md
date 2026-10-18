# fn-57 briefing B1 cluster 1

**Briefing:** B1
**Status:** final
**Cluster:** 1
**Rationale:** Docs build platform: the build and publish machinery the site needs, built as the real Vite plugin, head management and static generation pieces (MDX build step, per-page titles and Open Graph tags, route generation, static prerender, build-time search index, ui void-element fix)
**Chart:** fn-57

## Outcome

apps/docs becomes a SleekStack ui app served by @sleekstack/start with no dependency on kit, react, next, islands or fumadocs, keeping every page, snippet test and navigation (and search if wanted), so the four packages can be deleted.

## Cluster decisions

- **fn-57.D2:** Can MDX compile to the ui JSX runtime? - Yes. MDX compiles to the @sleekstack/ui JSX runtime with no changes to ui. All 27 hand-written pages and the 13 gener... - [record](.flow/charts/fn-57/2.md)
- **fn-57.D5:** Is search needed at launch, and what kind? - Search is required at launch, as a static index built at build time and searched in the browser. The build writes a s... - [record](.flow/charts/fn-57/5.md)
- **fn-57.D6:** Sequencing against fn-29, fn-30 and fn-33 - The docs rebuild is the first user of the Vite plugin, head management and static generation (open specs fn-29, fn-33... - [record](.flow/charts/fn-57/6.md)
- **fn-57.D7:** Hosting: static build or running start server? - The docs ship as a static site: production is prerendered HTML plus a client bundle, hostable on any static host or C... - [record](.flow/charts/fn-57/7.md)
- **fn-57.D12:** Open Graph images: generation approach - Use satori (layout to SVG) plus @resvg/resvg-js (SVG to PNG), run as a build step over the page list, with a plain ob... - [record](.flow/charts/fn-57/12.md)

## Shared context

Shared-context D-IDs are attributable evidence for this cluster but are not duplicated acceptance requirements by default.

- **fn-57.D6:** Sequencing against fn-29, fn-30 and fn-33 - The docs rebuild is the first user of the Vite plugin, head management and static generation (open specs fn-29, fn-33... - [record](.flow/charts/fn-57/6.md)
