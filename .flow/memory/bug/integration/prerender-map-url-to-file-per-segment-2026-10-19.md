---
title: "Prerender: map URL to file per segment; router handle must forward Head"
date: "2026-10-19"
track: bug
category: integration
module: packages/ui-vite/src/prerender/build.ts
tags: [ssg, prerender, head, router]
problem_type: integration
symptoms: pages overwrite each other via encoded slashes; Head tags missing from SSR HTML
root_cause: whole-path decode before join; handle never passed onHead
resolution_type: fix
related_to: [bug/integration/all-optional-structural-page-type-2026-10-19, bug/integration/analyzer-framework-tags-and-control-2026-10-17, bug/integration/link-prefetch-needs-route-loaders-in-a-2026-10-19, bug/integration/sleekstack-check-cannot-read-router-2026-10-15, bug/integration/ssr-serialize-time-errors-must-report-2026-10-18]
---

## Problem
Prerendering wrote each path to `decodeURIComponent(pathname)` joined onto the output dir. An encoded param like `a%2F..%2Findex` decoded to separators, so one route could overwrite another page's file while still passing a containment check. Separately, the router's `handle` never gave the renderers `onHead`, so page `<Head>` tags were missing from SSR and prerendered HTML.

## What Didn't Work
A whole-path decode plus a "stays inside outDir" check: it catches escapes, not collisions between pages.

## Solution
`packages/ui-vite/src/prerender/build.ts` maps per segment, rejects a decoded segment holding `/`, `\`, `.` or `..`, and refuses two paths writing one file. `packages/router/src/server.ts`: `document.before` may be `(head) => string`; only then are renderers given `onHead`, and the stream sends the opening once the shell's head is known. A streamed page sits under the router's `Pending`, so its head arrives as a `__sleekHead` patch: prerender with a string render to get tags in the written head.

## Prevention
Test URL-to-file mapping with encoded separators; test SSR output with a real `<Head>` page instead of a hard-coded document title.
