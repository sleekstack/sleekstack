---
title: Retry paths must close the failed attempt's scope and drop its closers
date: "2026-10-10"
track: bug
category: runtime-errors
module: packages/ui/src/jsx-runtime.ts
tags: [boundary, reset, scope]
problem_type: runtime-error
symptoms: Retry paths must close the failed attempt's scope and drop its closers
root_cause: catch inside the instance's own scope turned failure into success
resolution_type: fix
related_to: [bug/runtime-errors/captured-context-for-rerun-must-own-2026-10-03, bug/runtime-errors/external-app-scope-close-must-wait-for-2026-09-29, bug/runtime-errors/reactive-run-scopes-must-follow-2026-10-03]
---

## Problem
Boundary caught child failures inside its own run scope, so a scoped Provider directly under it stayed acquired while the fallback showed. Pending's per-fork closers accumulated on every failed reset.

## Solution
Run the boundary's children through `scopedRun` (closed on failure before the fallback). Remove a failed fork's closer from `slots.releases` in its onExit.

## Prevention
Test retry/resource balance with the Provider directly under the catching instance, not wrapped in another component.
