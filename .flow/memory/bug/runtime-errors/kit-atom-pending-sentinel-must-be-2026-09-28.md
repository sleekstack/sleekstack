---
title: Kit atom PENDING sentinel must be caught on the async path too
date: "2026-09-28"
track: bug
category: runtime-errors
module: packages/kit/src/atom.ts
tags: [atoms, kit, suspense, hooks]
problem_type: runtime-error
symptoms: async derived atom fails with Symbol(pending); hook order crash on atom-kind switch
root_cause: sentinel caught only synchronously; hook sequence branched on atom kind
resolution_type: fix
related_to: [bug/runtime-errors/atom-invalidation-must-track-visits-not-2026-09-28]
---

## Problem
A kit derived atom used a sync-thrown PENDING sentinel from `get` to mean "dependency loading". An async `fn` that calls `get` after an await rejects its Promise with the sentinel instead, and the atom became a Failure. Separately, `useAtomValue` picked different core hooks per atom kind, so a component switching atom kinds broke hook order.

## Solution
packages/kit/src/atom.ts: catch PENDING on the Promise path too (Effect.never). Lower every kit atom, writable included, to a Result-valued core atom so the hook always calls useAtomSuspense.

## Prevention
A sentinel thrown from a callback must be handled on both sync and async paths. Hooks must not branch on atom kind; normalize the representation.
