---
title: Fibers forked outside atom builds must stop on store dispose
date: "2026-10-02"
track: bug
category: runtime-errors
module: packages/query/src/query.ts
tags: [atoms, query, lifecycle]
problem_type: runtime-error
symptoms: Fibers forked outside atom builds must stop on store dispose
root_cause: runFork fibers not tied to store lifecycle
resolution_type: fix
related_to: [bug/runtime-errors/atom-invalidation-must-track-visits-not-2026-09-28, bug/runtime-errors/external-app-scope-close-must-wait-for-2026-09-29, bug/runtime-errors/kit-atom-pending-sentinel-must-be-2026-09-28]
---

## Problem
Trigger fibers forked with Effect.runFork outside the store survived AtomStore.dispose.

## Solution
Own them from a keepAlive registry atom whose finalizer stops them (packages/query/src/query.ts); dispose runs keepAlive finalizers.

## Prevention
Test dispose-without-release for any fiber started outside an atom build.
