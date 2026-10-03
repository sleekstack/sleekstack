---
title: Captured context for rerun must own Provider layer scopes
date: "2026-10-03"
track: bug
category: runtime-errors
module: packages/ui/src/reactive.ts
tags: [ui, scope, layer, reactive]
problem_type: runtime-error
symptoms: Captured context for rerun must own Provider layer scopes
root_cause: Effect.provide finalizes scoped layers at render end; captured services outlive them
resolution_type: fix
related_to: [bug/runtime-errors/external-app-scope-close-must-wait-for-2026-09-29]
---

## Problem
A reactive component's `rerun` captured the Effect Context, but `Provider` used `Effect.provide(layer)`, so scoped layers were finalized when the first render ended; reruns got released services. A first fix (one mount-wide scope) leaked a layer instance per rerun.

## Solution
`RenderScope` Context.Reference (packages/ui/src/reactive.ts). Each instance run forks a child scope; `Provider` builds its layer there (`Layer.buildWithScope`). A successful rerun closes the previous run's scope; a failed run closes its own; the mount scope closes everything.

## Prevention
Any captured-context rerun must capture resource lifetime too; test with `Layer.scoped` + acquireRelease log.
