---
title: Loader snapshot is stale after in-page navigation; refetch once paged
date: "2026-10-18"
track: bug
category: data
module: apps/realworld/src/pages/home.tsx
tags: [router, loader, pagination, optimistic]
problem_type: data
symptoms: Favorite reverts after paging away and back; next click re-favorites
root_cause: Page 1 re-rendered from the route loader snapshot while mutation state lived in disposed button instances
resolution_type: fix
related_to: [bug/data/sql-tag-aggregation-must-be-lossless-2026-10-18]
---

## Problem
The feed rendered page 1 from the route loader and later pages from a client fetch keyed by a page atom. Favoriting on page 1, paging to 2 and back re-rendered page 1 from the unchanged loader snapshot; the favorite button's per-instance action state had been disposed, so it showed the old count and a second click favorited again instead of unfavoriting.

## Solution
Once a page has been picked on the current path (`pageAtom.path === pathname`), every page shown, page 1 included, is fetched (`PickedPage` in apps/realworld/src/pages/home.tsx). The loader result only seeds the first server-rendered view.

## Prevention
Loader results are a one-time snapshot per pathname. Any view that mutates server state in per-instance UI state must not fall back to the snapshot after that instance unmounts. Test the round trip: mutate, navigate away within the page, come back, act again.
