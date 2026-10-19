---
title: Loader transfer keys must ignore a trailing slash (prerendered pages)
date: "2026-10-19"
track: bug
category: integration
module: packages/router/src/loader.ts
tags: [prerender, router, hydration]
problem_type: integration
symptoms: Prerendered page opened at /a/ reruns loaders on hydration
root_cause: Loader keys used the exact pathname; prerender renders the slashless path
resolution_type: fix
related_to: [bug/integration/all-optional-structural-page-type-2026-10-19, bug/integration/analyzer-framework-tags-and-control-2026-10-17, bug/integration/link-prefetch-needs-route-loaders-in-a-2026-10-19, bug/integration/prerender-map-url-to-file-per-segment-2026-10-19, bug/integration/sleekstack-check-cannot-read-router-2026-10-15]
---

## Problem
Prerender writes `<path>/index.html` for the slashless path, so a static server answers it at `/users/42` and `/users/42/`. The router keyed transferred loader results by the exact pathname, so hydration at `/users/42/` missed the server's results and reran the loader (a mismatch when the result differs, and a failure for build-only loaders).

## Solution
`keyOf` in packages/router/src/loader.ts drops a trailing slash before keying, on both server and client. Test: packages/router/src/__tests__/navigation.test.ts "hydrates a page rendered at /users/9 when opened at /users/9/".

## Prevention
Any URL-form normalization a build step applies (trailing slash, encoding) must also be applied wherever the client re-derives keys from `location`.
