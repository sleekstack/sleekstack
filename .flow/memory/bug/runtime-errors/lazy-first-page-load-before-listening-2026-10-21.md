---
title: "Lazy first page: load before listening; sync load() throw must be typed"
date: "2026-10-21"
track: bug
category: runtime-errors
module: packages/router/src/history.ts
tags: [router, lazy, hydration]
problem_type: runtime-error
symptoms: startRouter rejects with HydrateConflict after a click during the first page's code load
root_cause: listeners registered before an awaited load preceding hydrateMount; load() called outside the guarded promise
resolution_type: fix
related_to: [bug/runtime-errors/island-async-chunk-load-must-check-an-2026-09-29, bug/runtime-errors/stale-loader-replacement-must-be-in-the-2026-10-20]
---

## Problem
`startRouter` awaited the first page's lazy code before `hydrateMount`, but the click and popstate listeners were already registered. A click on a server-rendered link during that await mounted the next page, then hydration ran against the mounted container and `startRouter` rejected with `HydrateConflict`, returning no handle. Separately, `page.load()` was called outside the guarded promise, so a synchronous throw became a defect instead of a `LazyLoadError`.

## Solution
packages/router/src/history.ts: load the first page's code before adding listeners; until then a click is the browser's to follow. packages/router/src/resolve.ts: create the shared promise as `new Promise((ok) => ok(page.load()))` so sync throws reject like failed imports.

## Prevention
Any await added before a mount/hydrate must ask what the already-registered handlers can do during it. Test a promise-returning callback with both a sync throw and an async rejection.
