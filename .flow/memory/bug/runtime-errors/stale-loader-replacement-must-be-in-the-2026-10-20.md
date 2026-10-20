---
title: Stale loader replacement must be in the map (prior) so navigation reads share it
date: "2026-10-20"
track: bug
category: runtime-errors
module: packages/router/src/loader.ts
tags: [router, loader, navigation, stale]
problem_type: runtime-error
symptoms: Dependent loaders ran twice on same-path navigation; undeclared read kept the stale value
root_cause: "Replacement load held outside Loaders until settle, and only resolve saw the stale record"
resolution_type: fix
---

## Problem
Keeping the outgoing page's loader results during a navigation (fn-64) first kept a stale entry in the map and loaded its replacement outside the map until it settled. Review found two regressions: concurrent navigation reads of one stale key (a guard loader reading another declared loader) each started a separate load, and on a same-pathname navigation the incoming page's undeclared reads saw the stale value, because only `resolve` saw the stale record.

## What Didn't Work
A replacement held outside `Loaders` until settle: invisible to other readers, so nothing could share it. Giving only `resolve` the stale record: the incoming mount reads during `show`, before commit-time cleanup.

## Solution
packages/router/src/loader.ts: the fresh load goes into the map at once with `prior` set to the stale entry; readers without an active `Navigating.stale` (the page being left) read `prior`, and navigation readers join the load. A failed or interrupted load puts `prior` back. packages/router/src/history.ts gives `Navigating` to both resolve and the mount in `show`, deactivates it (`delete rec.stale`) at commit or when a newer navigation starts, and drops leftover `prior`s at commit.

## Prevention
Test stale-replace designs with two readers of one key (dependent loaders) and with an undeclared read on a same-pathname navigation.
