---
title: SSR page tags must come from Vite's HTML transforms and the whole CSS graph
date: "2026-10-18"
track: bug
category: integration
module: packages/ui-vite/src/entries.ts
tags: [vite, ssr, css, plugin-react]
problem_type: integration
symptoms: SSR page missing React refresh preamble and stylesheet links
root_cause: client markup hand-built from vite client + entry chunk importedCss only
resolution_type: fix
related_to: [bug/integration/build-time-id-duplicate-check-must-use-2026-10-18, bug/integration/kit-server-facades-must-rethrow-next-2026-10-03, bug/integration/node-loaded-packages-vite-plugins-need-2026-10-18, bug/integration/virtual-module-needs-a-declaration-and-2026-10-18, bug/integration/vite-plugin-memo-must-reset-per-build-2026-10-18]
---

## Problem
The SSR entries plugin built the client `<script>`/`<link>` markup by hand: in dev it wrote only `/@vite/client` + the entry, so plugin-react's refresh preamble never reached SSR pages (React guests throw "can't detect preamble"); in build it linked only the entry chunk's own `importedCss`, so `cssCodeSplit: false` (one combined CSS asset) and CSS of shared static chunks were missing.

## What Didn't Work
Hand-listing the dev tags and reading `chunk.viteMetadata.importedCss` of the entry alone.

## Solution
Dev: take the tags from `server.transformIndexHtml('/', '<html><head></head><body></body></html>')` (every plugin's injected tags), then add the entry script. Build: walk the entry's static `imports` collecting `importedCss`, and add every emitted `.css` asset when `cssCodeSplit` is off (`packages/ui-vite/src/entries.ts`). Also: `builder.build()` returns a watcher under `--watch`; check the shape instead of casting.

## Prevention
Never hand-build what Vite's HTML pipeline injects; test the SSR page with `react()` beside the plugin and with `cssCodeSplit` true and false.
