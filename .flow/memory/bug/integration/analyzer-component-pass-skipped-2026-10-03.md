---
title: Analyzer component pass skipped Effect.all list yields and nested guest props
date: "2026-10-03"
track: bug
category: integration
module: packages/analyze/src/components.ts
tags: [analyze, ui, fail-closed]
problem_type: integration
symptoms: Analyzer component pass skipped Effect.all list yields and nested guest props
root_cause: yield filter required A=Node exactly; guest props scanned one level
resolution_type: fix
related_to: [bug/integration/static-list-evaluation-must-key-object-2026-09-29]
---

## Problem
The ui component pass only walked yields typed Effect<Node>, so `yield* Effect.all(xs.map(C))` (Effect<Node[]>) dropped mapped components; root Effect combinators lost their E/R; guest props were checked one level deep.

## Solution
Accept Node arrays/tuples as rendered (isRendered), wrap the mount root in a node carrying the app's own E/R, and recursively inspect guest prop types (unions, arrays, objects; any fails closed).

## Prevention
Fixture assertions must inspect tree membership at the list member's line, not only the root.
