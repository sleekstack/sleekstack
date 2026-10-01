---
title: Control-flow classifier must rethrow on build failures and box matches
date: "2026-10-01"
track: bug
category: runtime-errors
module: packages/runtime/src/runtime.ts
tags: [runtime, control-flow]
problem_type: runtime-error
symptoms: Control-flow classifier must rethrow on build failures and box matches
root_cause: find() result used as match sentinel; build path only gated reporting
resolution_type: fix
---

## Problem
A pluggable control-flow classifier only suppressed reporting on app-layer build failures; the value was still wrapped in FiberFailure. `Array.find` also conflated a classified `undefined` with no match.

## Solution
`findControlFlow` returns a boxed `{ value }` via findIndex; the build-failure path throws `controlFlow.value` after disposing (packages/runtime/src/runtime.ts).

## Prevention
Test every exit path (call, request, app-layer build) for a classified value, including `undefined`.
