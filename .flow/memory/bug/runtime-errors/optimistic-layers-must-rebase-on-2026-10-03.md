---
title: "Optimistic layers must rebase on refetch by result identity, success only"
date: "2026-10-03"
track: bug
category: runtime-errors
module: packages/query/src/mutation.ts
tags: [query, optimistic, race]
problem_type: runtime-error
symptoms: "Optimistic layers must rebase on refetch by result identity, success only"
root_cause: rebase detected by value inequality at settle time
resolution_type: fix
related_to: [bug/runtime-errors/atom-writes-do-not-interrupt-an-in-2026-10-02, bug/runtime-errors/fibers-forked-outside-atom-builds-must-2026-10-02, bug/runtime-errors/island-async-chunk-load-must-check-an-2026-09-29, bug/runtime-errors/subscribe-only-suspense-promise-hangs-2026-10-02]
---

## Problem
Optimistic layers only rebased on the next recompute, so a refetch landing mid-mutation showed raw server data, and value-equality detection missed a refetch equal to the optimistic value.

## What Didn't Work
Polling `getData() != lastShown` at settle time: late, and blind to equal values and failed refetches (Failure keeps previousValue).

## Solution
packages/query/src/mutation.ts optimistic: while a log lives, subscribe to the query atom; a settled Success result the log did not write (identity vs the Result it last wrote) becomes the base and layers re-render immediately.

## Prevention
Test refetch-mid-mutation with: different value, equal value, failed refetch, then success and failure settles.
