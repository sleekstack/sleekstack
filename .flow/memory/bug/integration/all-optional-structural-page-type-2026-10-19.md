---
title: All-optional structural page type rejects real router pages (weak type)
date: "2026-10-19"
track: bug
category: integration
module: packages/ui-vite/src/prerender/enumerate.ts
tags: [typescript, router, prerender]
problem_type: integration
symptoms: TS2345 no properties in common when passing router pages
root_cause: "weak-type detection on an all-optional type; tests used {} stand-ins"
resolution_type: fix
related_to: [bug/integration/analyzer-framework-tags-and-control-2026-10-17, bug/integration/link-prefetch-needs-route-loaders-in-a-2026-10-19, bug/integration/sleekstack-check-cannot-read-router-2026-10-15]
---

## Problem
A structural input type for router pages, `{ readonly prerender?: PrerenderParams }`, has only optional members, so TypeScript's weak-type check rejected real pages (`{ render }`) with "no properties in common". Tests passed because they used `{}` for static pages. Param filling also read `params[key]` without an own-property check, so `:toString` filled from `Object.prototype`, and `.`/`..` values passed `encodeURIComponent` unchanged and would resolve to another URL.

## Solution
`object & { readonly prerender?: ... }` (packages/ui-vite/src/prerender/enumerate.ts) defeats the weak-type check; a test builds pages with `router()` from @sleekstack/router. Params use `Object.hasOwn` + non-empty string check, and `.`/`..` throw naming the route.

## Prevention
Test structural "accepts the X" types with the real producer (`router()`), never `{}` stand-ins. Any user-keyed record lookup uses `Object.hasOwn`.
