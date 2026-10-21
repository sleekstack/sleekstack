---
title: "Analyzer must nest file-route pages inside layout children, check chains per pag"
date: "2026-10-21"
track: bug
category: integration
module: packages/analyze/src/components.ts
tags: [analyzer, file-routes, layouts]
problem_type: integration
symptoms: Layout Provider did not satisfy page requirements in sleekstack check; stale per-page layout chain not reported
root_cause: Layouts analyzed as siblings of the page; declaration validated as a global file set
resolution_type: fix
---

## Problem
`sleekstack check` read file-route layouts as siblings of their page under the `Route` provide, while the generated module renders the page inside each layout's `children`. A layout returning `<Provider layer={DbLive}>{children}</Provider>` still left its page reported as missing `Db`. Declaration validation also compared one global file set, so a page whose declared layout chain was stale (layout dropped or reordered) passed silently.

## What Didn't Work
Flat siblings (`[...layoutNodes, ...pageNodes]`) and an "every layout file is named somewhere" check.

## Solution
packages/analyze/src/components.ts: `layoutElement` sets a `slot` (the layout's `children` symbols: destructured `children` or `props.children`) while rendering the layout's default export; `read` / `embedded` return the inner nodes at that position, falling back to siblings if the layout never renders children. Loaders stay beside the render. `routeFiles` returns each route file's expected layout chain, and `filePages` compares it per page in order.

## Prevention
When the analyzer models a runtime composition, mirror the runtime's nesting, not a flattened list; validate a generated declaration per entry, not as a union of files.
