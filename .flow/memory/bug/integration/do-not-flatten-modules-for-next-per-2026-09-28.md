---
title: Do not flatten modules for next per-call provide
date: "2026-09-28"
track: bug
category: integration
module: packages/kit/src/next/action.ts
tags: [kit, next, shadowing]
problem_type: integration
symptoms: Do not flatten modules for next per-call provide
root_cause: module boundaries erased before core child scope
resolution_type: fix
---

## Problem
Flattening kit modules to bare entries for next per-call provide put imported and local layers at equal precedence (AmbiguousProvider instead of Shadowing).

## Solution
Pass core modules from unwrap() through; core child() accepts Entry|Module even though next types provide as Entry[] (cast in packages/kit/src/next/action.ts).

## Prevention
Test local-over-import override through every provide entry point.
