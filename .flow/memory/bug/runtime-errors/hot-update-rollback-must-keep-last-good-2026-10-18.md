---
title: Hot-update rollback must keep last good function across instances
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/ui/src/reactive.ts
tags: [hmr, acceptUpdate, ui]
problem_type: runtime-error
symptoms: One instance's success discarded the fallback; another instance stayed on a throwing update
root_cause: Single prev cleared on first per-instance success; overlapping updates overwrote fallback
resolution_type: fix
---

## Problem
Hot-update rollback in `acceptUpdate` kept a single `prev` function and cleared it on the first successful run. With several live instances, one instance succeeding discarded the fallback before another instance threw, so the failing one stayed broken. Two updates landing before any re-run also saved the unvalidated first update as the fallback.

## What Didn't Work
`prev` cleared on first success: per-instance success is not proof the update works for all props/state.

## Solution
Track `good` (last function that ran successfully) separately from `fn`, plus `succeeded`. `acceptUpdate` promotes `fn` to `good` only if it succeeded. A failing run of `fn != good` sets `fn = good`, bumps the per-id version atom in every live store (all instances converge), reports, and retries. Live stores are ref-counted per instance via a release pushed on the instance's `Slots.releases`, so disposed mounts drop out (packages/ui/src/reactive.ts, acceptUpdate / instance).

## Prevention
Test hot-update rollback with two instances where only one throws, and with two updates before a re-run.
