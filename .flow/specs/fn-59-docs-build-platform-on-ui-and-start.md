## Conversation Evidence

- [user] "rebuild the docs site ... as a SleekStack ui app served by @sleekstack/start, dogfooding the framework" (chart fn-57 outcome)
- [user] Search: "Static index built at build time, searched in the browser" (D5)
- [user] Sequencing: "Docs as the first user of fn-29, fn-33 and fn-30" (D6)
- [user] Hosting: "Static site, start only in dev" (D7)
- [paraphrase] Evidence from the resolved decisions: MDX compiles to the ui JSX runtime with small plugins (D2); Open Graph images with satori and resvg (D12). Source: chart fn-57, briefing B1, cluster 1.

## Goal & Context
<!-- scope: business -->

The docs site has to move off Next and fumadocs, which are React-only, so that the four React and Next packages can be deleted. The chart for that rebuild (fn-57) found that the site needs a build and publish pipeline that `@sleekstack/ui` apps do not have yet: compile MDX to ui components, give each page a title and social tags, generate routes, prerender every page to static HTML, and build a search index. The user decided the docs rebuild is the first user of the open Vite plugin, head management and static generation specs (fn-29, fn-33, fn-30): it builds the slimmed parts it needs as real packages, not throwaway code. [user]

This spec is the platform half: the pipeline and its packages. The site itself (layout, content migration, search dialog, tests) is the second spec and depends on this one. [paraphrase]

## Architecture & Data Models
<!-- scope: technical -->

- **MDX build.** Each content page compiles to a ui component with the page's frontmatter exported alongside it. The compiler targets `@sleekstack/ui`'s JSX runtime directly, with no change to ui for that. It needs: frontmatter export, GitHub-style tables, expansion of the `<include>` tag the guides use for code samples, heading ids, HTML attribute names, and table alignment that does not produce style objects. Probed on all 27 guides and the 13 generated API pages. [paraphrase]
- **Code highlighting.** Done at build time by a rehype plugin; the output is static markup plus one generated stylesheet and no client JavaScript. Highlighter inline styles become classes because ui renders style objects as `[object Object]`. [paraphrase]
- **ui renderer fix.** The string renderer has no list of void elements, so it writes `<br></br>`, `<hr></hr>` and `<img></img>`; browsers read the closing `</br>` as a second `<br>`. It must write void elements without closing tags. [paraphrase]
- **Head.** Per-page `title`, `meta` and `link` for string, stream and DOM rendering, with the contract of the open head-management spec (fn-33): entries dedupe by key, the deepest wins, hydration adopts server tags. It carries Open Graph and Twitter-card tags. `og:image` must be an absolute URL, so the build needs a configured site origin; a static host has no request origin. [paraphrase]
- **Routes.** Generated from the content tree and its order file into a route table the router can use, with an optional base prefix (so a version or locale prefix can be added later without moving pages). [paraphrase]
- **Prerender.** The build writes one HTML file per route plus the client bundle. In development the same pages are served by the `@sleekstack/start` fetch handler behind the Vite dev server; production output does not depend on `start`. [user]
- **Search index.** The build writes an index (title, headings, text) from guides and API pages; the browser searches it with a small client function, no server. [user]
- **Open Graph images.** One 1200 by 630 PNG per route at build time: a plain layout tree rendered to SVG (satori) and rasterized (resvg), fonts read from files, no React and no browser. Measured about 350 ms for 40 images. [paraphrase]
- **Packaging.** The pipeline ships as workspace packages: the Vite plugin package of fn-29 (build, routes, prerender, dev entry), head management in ui. fn-29, fn-33 and fn-30 are trimmed to what remains afterwards. [user]

## API Contracts
<!-- scope: technical -->

- **Plugin options:** content directory, order file, site origin, optional base prefix, Open Graph switch and font files, search-index switch. [paraphrase]
- **`<Head>` component** and the head string for `renderToString` / `renderToStream` as fn-33 specifies. [paraphrase]
- **A compiled page** exports its component and `frontmatter`. [paraphrase]
- **Search client:** given the index and a query, returns ranked results (title, anchor, snippet); empty query returns none. [inferred]

## Edge Cases & Constraints
<!-- scope: technical -->

- A page that fails to compile, an `<include>` whose file is missing, a broken internal link or anchor, a route that fails to prerender, and a missing font file each fail the build and name the page, line or route. [paraphrase]
- The heading ids must match the ids the link checker computes (github-slugger), or the checker changes with them. [paraphrase]
- The Open Graph image step and the search index can be switched off for development builds. [inferred]
- Production output must serve correctly from a plain static file server. [user]
- ui's size budget (ADR 0022) is re-measured; the head module must not grow ui's mount entries beyond the budget without a recorded decision. [inferred]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A content page compiles to a ui component that exports its frontmatter; all current guides and generated API pages compile and render to HTML. Errors: invalid MDX fails the build naming the file and line; an `<include>` with a missing file fails naming the page and the path. [paraphrase]
- **R2:** Rendered pages have tables, links, lists, inline code, heading ids and build-time highlighted code blocks, with no style objects leaking into attributes and no client JavaScript for highlighting. Errors: an unknown fence language is reported at build, not silently dropped. [paraphrase]
- **R3:** ui's string and stream renderers write void elements (`br`, `hr`, `img`, `input`, `meta`, `link` and the rest of the HTML list) without a closing tag. Errors: children given to a void element are reported as an error instead of rendered; existing ui tests keep passing. [paraphrase]
- **R4:** `<Head>` sets title, meta and link in string, stream and DOM output, with nested overrides, key dedupe and hydration adopting server tags, as in the head-management spec; it carries Open Graph and Twitter-card tags. Errors: an `og:image` requested without a configured site origin fails the build with a clear message; an invalid tag or attribute is rejected like an element. [paraphrase]
- **R5:** A route table is generated from the content tree and its order file, with an optional base prefix; internal links and heading anchors are validated at build. Errors: a broken link or anchor fails the build naming source and target; a route added or removed is picked up without restarting dev. [paraphrase]
- **R6:** The build writes one HTML file per route (content and head tags) plus the client bundle; output serves correctly from a static file server in a test, and every page hydrates without a mismatch. Errors: a render or compile error fails the build naming the route. [user]
- **R7:** In development the pages are served by the `start` fetch handler behind the Vite dev server and update when content changes; production output does not import `@sleekstack/start`. Errors: a content error is reported in the overlay and clears when fixed. [user]
- **R8:** The build writes a search index from the guides and API pages and a client function searches it without a server; the build reports the index size. Errors: an empty query returns no results; a missing index is an error, not an empty result. [user]
- **R9:** The build writes one 1200 by 630 PNG per route from the page title and description with the layout-tree renderer, referenced by an absolute `og:image`. Errors: a missing font file fails the build; with the switch off no image is written and no `og:image` is emitted. [paraphrase]
- **R10:** The pieces ship as workspace packages with READMEs, ADRs for the decisions, AGENTS.md verify rows and CONTEXT terms; fn-29, fn-30 and fn-33 are trimmed or marked superseded; ui's size budget is re-measured. Errors: no error surface beyond the checks in R1 to R9. [paraphrase]

## Boundaries
<!-- scope: business -->

- No site layout, styling, search dialog or content migration: that is the docs site spec. [paraphrase]
- No HMR that keeps component state (fn-31), no deploy adapters, no incremental builds. [paraphrase]
- No versioning, translations or analytics. [user]
- No change to the documentation content itself. [paraphrase]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Dogfooding: the docs are the first real consumer of the build pipeline, so the pipeline is shaped by a real site instead of a guess. Sequencing the three open specs behind the docs would delay the removal of the React and Next packages; a minimal bespoke setup would be rework. [user]

### Implementation Tradeoffs
<!-- scope: technical -->

Rejected: building fn-29, fn-33 and fn-30 first and the docs after (delays package removal); a docs-only bespoke Vite setup (replaced later); a production `start` server (nothing a static site lacks); Playwright screenshots for Open Graph images (a browser dependency, unmeasured and slower); server-side search. [user]

Source: chart fn-57 decisions D2, D5, D6, D7, D12 and briefing B1 cluster 1.
