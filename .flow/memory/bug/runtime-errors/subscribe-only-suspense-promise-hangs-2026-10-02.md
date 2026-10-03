---
title: Subscribe-only suspense promise hangs on synchronous query
date: "2026-10-02"
track: bug
category: runtime-errors
module: packages/react/src/query.ts
tags: [react, suspense, query]
problem_type: runtime-error
symptoms: Subscribe-only suspense promise hangs on synchronous query
root_cause: AtomStore.subscribe does not notify for a value produced by its initial pull
resolution_type: fix
related_to: [bug/runtime-errors/atom-writes-do-not-interrupt-an-in-2026-10-02, bug/runtime-errors/external-app-scope-close-must-wait-for-2026-09-29, bug/runtime-errors/fibers-forked-outside-atom-builds-must-2026-10-02, bug/runtime-errors/kit-atom-pending-sentinel-must-be-2026-09-28]
---

## Problem
A suspense helper that resolves only from `store.subscribe` listeners hangs forever when the query's Effect completes synchronously: the initial pull inside subscribe produces the value without notifying.

## Solution
After `Query.observe`, call the settle check once directly (packages/react/src/query.ts `loaded`), guarding against the release handle not yet being assigned.

## Prevention
Every subscribe-driven promise in hooks needs an immediate post-subscribe check (atoms.ts `suspensionFor` does this); test with `Effect.succeed` as well as async fetches.
