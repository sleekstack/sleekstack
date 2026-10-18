---
title: Removing a facade must keep reading its core equivalents (atoms; Tags are Effect
date: "2026-10-17"
track: bug
category: integration
module: packages/analyze/src/extract.ts
tags: [analyzer, atoms, kit-removal]
problem_type: integration
symptoms: Report.atoms dropped; Atom.make(Tag) skipped
root_cause: Kit atom reader deleted without a core Atom.make reader; Effect check ignored Tag types
resolution_type: fix
related_to: [bug/integration/new-ui-component-factory-needs-analyzer-2026-10-09, bug/integration/sleekstack-check-cannot-read-router-2026-10-15, bug/integration/static-list-evaluation-must-key-object-2026-09-29]
---

## Problem
Removing kit from the analyzer, the kit atom reader (deps arrays) was deleted along with `Report.atoms`, on the grounds that the analyzer never read core atoms. Review flagged it: the task named atoms as a concept with a core equivalent to keep reading.

## What Didn't Work
Treating "no core reader exists today" as licence to drop the field. Also, a first core reader checked only for `effect/Effect#Effect` / `Stream` return types and silently skipped `Atom.make(Tag)`, since a Tag's type symbol is the Tag class, not Effect.

## Solution
`atomOf` in packages/analyze/src/extract.ts reads `Atom.make(arg)`: it takes the arg type (or the read function's return type). A Tag class or `Context.Tag` type requires itself; an Effect/Stream's `R` members map to Tags; anything else, like a value or a sync derived atom, is skipped. `Atom.family` is covered because its inner `Atom.make` is visited.

## Prevention
When removing a facade, list each concept it exposed and check whether core has an equivalent before deleting its output. Tags are Effects in effect v3, so every "is this an Effect" type check must also accept Tag types.
