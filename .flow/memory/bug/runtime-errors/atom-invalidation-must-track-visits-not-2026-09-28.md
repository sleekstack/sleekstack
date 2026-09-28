---
title: "Atom invalidation must track visits, not stale state"
date: "2026-09-28"
track: bug
category: runtime-errors
module: packages/core/src/atom/AtomStore.ts
tags: [atoms, invalidation]
problem_type: runtime-error
symptoms: "Atom invalidation must track visits, not stale state"
root_cause: state used as visited marker survives failed pulls
resolution_type: fix
---

## Problem
Push-invalidation stopped at nodes already in 'check'/'dirty', assuming their descendants were queued; a failed pull leaves nodes stale, so later recoveries never reached subscribers.

## Solution
Track visited nodes per traversal in markChildren (packages/core/src/atom/AtomStore.ts), not node state. Also record dependency edges before pulling so a throwing read still re-runs.

## Prevention
Test throw-then-recover through a chain of at least three derived atoms.
