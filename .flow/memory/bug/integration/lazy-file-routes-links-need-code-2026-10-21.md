---
title: "Lazy file routes: Links need code prefetch; read virtual routes exports lazily"
date: "2026-10-21"
track: bug
category: integration
module: apps/realworld/src/routes/_links.ts
tags: [file-routes, lazy-pages, link-prefetch, ssr-cycle]
problem_type: integration
symptoms: First click on a lazy route waits for its chunk; hover only warmed loaders
root_cause: Links kept loaders-only props after pages became lazy client chunks
resolution_type: fix
related_to: [bug/integration/analyzer-must-nest-file-route-pages-2026-10-21, bug/integration/analyzer-reads-every-file-route-through-2026-10-20]
---

## Problem
Moving realworld to file routes made every client page a lazy chunk, but the migrated `Link`s still passed only `loaders`. Hovering a link warmed the data and not the page code, so the first click waited on code and then on data.

## What Didn't Work
Keeping the old Link props unchanged. They were correct while every page was eager, and wrong once `pages[name]` became `{ load }` on the client.

## Solution
`apps/realworld/src/routes/_links.ts` has `code(name) = () => pages[name].load?.() ?? Promise.resolve()`. Each page-body link passes `code` beside `loaders`, and `previewTargets` pairs both for article previews. `pages` is read only when the closure runs. Route files import `virtual:sleekstack/routes` while that module is still importing them in SSR, so a read at module top level sees TDZ/undefined. The same applies to `table`: never put it in a module-level object such as `previewLinks`. Spread it at render time.

## Prevention
When pages move to lazy file routes, grep every `<Link` with `loaders=` and give it `code=`. In route files and `_` helpers, read the virtual module's exports only inside functions.
