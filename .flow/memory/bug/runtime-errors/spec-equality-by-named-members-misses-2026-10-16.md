---
title: Spec equality by named members misses class-instance settings
date: "2026-10-16"
track: bug
category: runtime-errors
module: packages/ui/src/reactive.ts
tags: [useDraft, equality, rerun]
problem_type: runtime-error
symptoms: Swapping to another instance of a spec class did not re-seed the Draft
root_cause: "sameSpec compared only the five contract callbacks, shared by every instance via the prototype"
resolution_type: fix
related_to: [bug/runtime-errors/after-commit-work-in-ui-hooks-goes-on-2026-10-10, bug/runtime-errors/captured-context-for-rerun-must-own-2026-10-03]
---

## Problem
`useDraft` treated a new `spec` as "no swap" when its five contract members (`schema`, `create`, `toDto`, `toModel`, `diff`) were the same functions. Two instances of a spec class share their prototype methods, so `new Capped(2)` replaced by `new Capped(1)` kept the old spec: the Draft neither re-seeded nor used the new settings.

## What Didn't Work
Comparing a fixed list of named members. It catches `{ ...Spec }` copies, but any setting that lives outside those members (own fields, private fields, closures over `this`) is invisible to it.

## Solution
One comparison for both the source and the spec (`same` in packages/ui/src/reactive.ts): `Object.is`, or `Equal.equals` inside `structuralRegion`, which compares plain objects and arrays by structure, functions by identity, and any other non-`Equal` object (a class instance) by identity. Regression test: "R8: another instance of a spec class is a swap" in draft.test.ts.

## Prevention
When deciding "is this the same input across re-runs", compare plain data structurally and everything else by identity; never by a hand-picked member list. Test with two class instances that share methods but differ in a field.
