---
title: "Per-instance hot history must live on Slots, not the instance() closure"
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/ui/src/reactive.ts
tags: [hmr, slots, reactive]
problem_type: runtime-error
symptoms: Hook-count hot update reports SlotMismatch when a parent re-run reaches the child first
root_cause: instance() closure is recreated per parent run while Slots persist
resolution_type: fix
---

## Problem
The hot remount check compared the function a run called with the one the instance's last successful run called, but kept that last function in the `instance()` closure. Child slots outlive that closure: a parent re-run builds a fresh closure over the same slots, so the check saw no history, and a valid hook-count edit failed into `onError` and was reverted.

## What Didn't Work
A `let committed` in the `instance()` closure. It only held up when the instance re-ran itself.

## Solution
Per-instance history belongs on `Slots` (`Slots.ran` in packages/ui/src/reactive.ts), which the parent's `kids` registry keeps across re-runs. The revert path also resets slots when the failed run was a fresh one (`!slots.done`), so the previous function does not pick up the partial slots of a remount that threw.

## Prevention
Put any state that must survive across instance runs on `Slots`, not in the `instance()` closure. Test each such path twice: once on a self re-run, once on a parent re-run that creates a new closure.
