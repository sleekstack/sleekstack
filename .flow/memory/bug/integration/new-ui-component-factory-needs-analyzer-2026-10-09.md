---
title: "New ui component factory needs analyzer support, not a tsconfig exclude"
date: "2026-10-09"
track: bug
category: integration
module: packages/analyze/src/components.ts
tags: [analyzer, lazy, ui]
problem_type: integration
symptoms: "New ui component factory needs analyzer support, not a tsconfig exclude"
root_cause: analyzer only resolves fromReact call-produced components
resolution_type: fix
---

## Problem
A new call-produced component (`lazy`) was rejected by `sleekstack check` as a "dynamic component", and its public type erased the loaded component's E/R.

## What Didn't Work
Excluding the demo entry from tsconfig to keep the clean-demo test green hid the gap; review flagged it.

## Solution
packages/analyze/src/components.ts: a `ui/lazy#lazy` branch follows `() => import()` to the module's default export. packages/ui/src/lazy.ts returns `Effect<Node, E | LazyLoadError, R>`.

## Prevention
Any new ui component factory needs an analyzer branch plus a fixture in the same change; never exclude a file to silence the checker.
