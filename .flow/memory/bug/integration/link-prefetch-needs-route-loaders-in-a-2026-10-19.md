---
title: "Link prefetch needs route loaders in a leaf module, not page modules"
date: "2026-10-19"
track: bug
category: integration
module: apps/realworld/src/pages/loaders.ts
tags: [router, link, prefetch, import-cycle, realworld]
problem_type: integration
symptoms: Hover on preview/edit links prefetched nothing; loaders unreachable without an import cycle
root_cause: Loaders declared in page modules that import each other at evaluation time
resolution_type: fix
related_to: [bug/integration/analyzer-framework-tags-and-control-2026-10-17, bug/integration/sleekstack-check-cannot-read-router-2026-10-15]
---

## Problem
Converting realworld anchors to router `Link`, the article-preview links (in a module's presentation layer) and the article page's Edit link shipped with no or partial `loaders`, so hover prefetched nothing there. The loaders lived in page modules that import each other at evaluation time (profile calls home's `articleSource`; editor's `editable` reads article's `article`), so naming them from another page risked a TDZ import cycle.

## What Didn't Work
Injecting a link component into the presentation layer: `sleekstack check` reports a prop-passed component as "dynamic component; declaration cannot be read". Leaving the loaders out with a comment explaining the cycle was flagged as an incomplete R4.

## Solution
Move every loader that another page's link names into a leaf `apps/realworld/src/pages/loaders.ts` (plus route loader sets and `previewLinks`), re-exported from the original page modules for `app.tsx`. Presentation renders router `Link` directly and takes `{ table, article, profile, login }` loader sets as a prop; the architecture test allows `@sleekstack/router` in presentation.

## Prevention
When a link must prefetch another route, check where that route's loaders live before wiring: loaders shared across pages belong in a leaf module, not in page components. A parametrized hover test per link family (tag, preview title, preview author) catches empty `loaders`.
