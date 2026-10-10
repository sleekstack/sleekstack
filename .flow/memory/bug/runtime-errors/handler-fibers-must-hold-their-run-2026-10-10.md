---
title: Handler fibers must hold their run scope across re-runs
date: "2026-10-10"
track: bug
category: runtime-errors
module: packages/ui/src/dom.ts
tags: [ui, scope, handler, provider]
problem_type: runtime-error
symptoms: Handler fibers must hold their run scope across re-runs
root_cause: Run scope closed on re-run while handler fiber still used its Provider layer
resolution_type: fix
---

## Problem
A handler that sets state its owner reads (useAction's waiting Result) re-runs the component; when that component renders a Provider, the re-run closed the old run scope and finalized the layer the still-running handler used.

## Solution
LazyScope.hold() (packages/ui/src/reactive.ts) defers close while handler fibers run, walking lazy ancestors; dom.ts fork holds the binding context's RenderScope until the fiber exits.

## Prevention
Test async handlers under a Provider inside the re-running component with Layer.scoped + acquireRelease log.
