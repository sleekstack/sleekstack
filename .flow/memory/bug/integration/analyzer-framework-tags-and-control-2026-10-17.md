---
title: "Analyzer framework Tags and control errors must match by declaration, not name"
date: "2026-10-17"
track: bug
category: integration
module: packages/analyze/src/components.ts
tags: [analyzer, router, identity]
problem_type: integration
symptoms: app Tag named Route or app NotFound error passed as router-provided in sleekstack check
root_cause: router roots compared Tags and error _tags by printed name; Route scoped to notFound
resolution_type: fix
---

## Problem
The first cut of `startRouter` / `handle` roots in the component pass compared framework-provided Tags and router control errors by printed name: an app Tag called `Route` passed as the router's, an app error with `_tag: 'NotFound'` was treated as router control flow, and `Route` was provided to `notFound` although the router adds `routeLayer` only for a matched page.

## What Didn't Work
A flat `ROUTER_PROVIDES` name list on the root plus `catch` nodes on the bare `_tag`. A first identity check, `ROUTER_CONTROL[tag] === libId(sym)`, also matched every app error because both sides were `undefined`.

## Solution
`packages/analyze/src/components.ts`: `FRAMEWORK_TAGS` maps each implicit Tag name to its declaration's `libId`, and `tagName` file-qualifies a same-named Tag declared elsewhere. `errorTags` prefixes the router's own `Redirect` / `NotFound` (by `libId`, guarded with `Object.hasOwn`) with `@sleekstack/router#`. Root catches use the prefixed name, and `check` still lets a `Catch` / `Boundary` match by bare `_tag`. Each page sits under a `provide ['Route']` node, and `notFound` sits outside it.

## Prevention
For any analyzer-modeled framework service or error, match on the declaration (`libId`), never the printed name, and add a fixture with a same-named app type. Diff `sleekstack check --json` on the showcase before and after: that diff caught the `undefined === undefined` regression.
