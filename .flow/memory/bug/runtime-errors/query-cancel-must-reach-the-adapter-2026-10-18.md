---
title: "Query cancel must reach the adapter call, not a Store-owned de-duped find"
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/model/src/query.ts
tags: [query, cancellation, effect, records]
problem_type: runtime-error
symptoms: unmount left the adapter call running; second cancel did nothing
root_cause: "find forks into the Store scope, so the abort interrupted only the waiter; waiter count left twice"
resolution_type: fix
related_to: [bug/runtime-errors/atom-writes-do-not-interrupt-an-in-2026-10-02, bug/runtime-errors/fibers-forked-outside-atom-builds-must-2026-10-02, bug/runtime-errors/optimistic-layers-must-rebase-on-2026-10-03, bug/runtime-errors/record-reader-atoms-must-be-keyed-by-2026-10-18, bug/runtime-errors/subscribe-only-suspense-promise-hangs-2026-10-02]
---

## Problem
`queryOf(record)`'s TanStack query function ran `record.find(id)`. `find` forks the adapter call into a Store-owned scope and de-duplicates it, so the query's abort signal interrupted only the waiter: the adapter call kept running and wrote into the map after unmount. The waiter count also decremented twice (interrupt plus settle), turning into `NaN` so later cancels never fired.

## What Didn't Work
A test that only checked the query's `fetchStatus` went idle after unmount: it passed while the adapter call ran on.

## Solution
The query function runs find's steps (`stamp()`, adapter `find`, decode, id check, `ingest`) in its own fiber (packages/model/src/query.ts `queryFn`); TanStack de-duplicates instead. Each waiter's `leave()` is guarded by a per-call flag.

## Prevention
A cancellation test asserts the adapter's own interruption handler ran, and runs the mount/unmount cycle twice.
