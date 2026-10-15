---
title: sleekstack check cannot read router Link; host routed pages via startRouter
date: "2026-10-15"
track: bug
category: integration
module: apps/showcase/src/pages/router.tsx
tags: [router, analyzer, showcase, link]
problem_type: integration
symptoms: sleekstack check reports Unresolved for <Link> from @sleekstack/router
root_cause: analyzer libId omits @sleekstack/router; Link is a declare const in .d.ts
resolution_type: fix
related_to: [bug/integration/new-ui-component-factory-needs-analyzer-2026-10-09]
---

## Problem
A showcase demo had to use `@sleekstack/router`'s `Link`, but `sleekstack check` reports any `<Link>` (or `Link({...})`) in a tree it walks as `Unresolved`: "dynamic component; its declaration cannot be read". The analyzer's `libId` knows only kit/core/next/runtime/query/ui, and `Link` is a `declare const` in the router's `.d.ts`, so `calleeTarget` fails closed.

## What Didn't Work
Writing out the anchor `Link` renders (`<a onMouseEnter={prefetchLoader(...)}>`) kept the check clean, but all three review draws rejected it: R7 named `Link`, and a hand-copied anchor hides regressions in the real component.

## Solution
Run the routed pages as a real router app: `router({ table, pages, notFound })` started with `startRouter` in a `useEffect` (`Effect.acquireRelease` around `startRouter`, `nav.dispose()` as release) on a `useRef` div (`apps/showcase/src/pages/router.tsx`). `startRouter` is not an analyzer root, so the routed pages (with `Link`) sit outside the component pass, and the check stays clean with no package change. Test with `handle(router, request)` for SSR and `startRouter` on that HTML for hydration; stub `window.scrollTo` in jsdom.

## Prevention
Before demoing a package component under `sleekstack check`, confirm the analyzer reads it (`libId` in packages/analyze/src/extract.ts). Router pages are not analyzed at all; analyzer support for `@sleekstack/router` is a separate package change.
