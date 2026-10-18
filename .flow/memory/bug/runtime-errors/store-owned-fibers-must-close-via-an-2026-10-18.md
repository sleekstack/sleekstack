---
title: Store-owned fibers must close via an Effect atom build scope so dispose awaits t
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/model/src/adapter.ts
tags: [atoms, lifecycle, dispose]
problem_type: runtime-error
symptoms: await store.dispose() returned before in-flight find cleanup finished
root_cause: finalizer forked Scope.close untracked by AtomStore.dispose
resolution_type: fix
---

## Problem
`find`'s in-flight fibers were owned by a Scope made in a keepAlive atom whose finalizer ran `Effect.runFork(Scope.close(...))`. `AtomStore.dispose()` returned before interrupted adapter calls finished their (asynchronous) cleanup, so `atomStoreFor` could release scope services while the cleanup still used them.

## What Didn't Work
A plain `get.addFinalizer` on a keepAlive atom: dispose runs it, but does not await anything it forks.

## Solution
Make the owner an Effect atom whose build returns its own build scope: `Atom.keepAlive(Atom.make(Effect.map(Effect.scope, (scope) => ({ calls, scope }))))` and fork work with `Effect.forkIn(work, scope)` (packages/model/src/adapter.ts). Store dispose closes Effect-build scopes through its tracked `closing` promises and awaits them.

## Prevention
Test dispose with an adapter whose `onInterrupt` cleanup is delayed (e.g. `Effect.delay(..., '10 millis')`) and assert the cleanup ran when `await store.dispose()` resolves.
