---
title: Atom writes do not interrupt an in-flight Effect build
date: "2026-10-02"
track: bug
category: runtime-errors
module: packages/query/src/queries.ts
tags: [atoms, query, race]
problem_type: runtime-error
symptoms: Atom writes do not interrupt an in-flight Effect build
root_cause: AtomStore.set only pulls then writes; the fetch fiber keeps running
resolution_type: fix
related_to: [bug/runtime-errors/atom-invalidation-must-track-visits-not-2026-09-28, bug/runtime-errors/fibers-forked-outside-atom-builds-must-2026-10-02, bug/runtime-errors/island-async-chunk-load-must-check-an-2026-09-29, bug/runtime-errors/kit-atom-pending-sentinel-must-be-2026-09-28]
---

## Problem
Queries.setData wrote over a node with a fetch in flight; AtomStore.set does not run the node's finalizers, so the fetch later overwrote the write. reset on an unobserved node left its old value cached for the next build.

## Solution
Cancel first: refresh the node under a store-scoped build override that skips the fetch (packages/query/src/queries.ts cancelOne), then write. reset rebuilds as Initial under a 'clear' override, then refreshes.

## Prevention
Any direct write to an Effect atom must interrupt the running build first; test writes during a delayed fetch.
