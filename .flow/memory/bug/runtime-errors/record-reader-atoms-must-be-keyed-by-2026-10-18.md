---
title: "Record reader atoms must be keyed by type and id, not per definition"
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/model/src/registry.ts
tags: [atoms, records, identity-map]
problem_type: runtime-error
symptoms: Two defineRecord calls of one type returned different atoms for one id
root_cause: Reader cache was a strong Map per definition instead of shared by type and id
resolution_type: fix
related_to: [bug/runtime-errors/atom-invalidation-must-track-visits-not-2026-09-28, bug/runtime-errors/atom-writes-do-not-interrupt-an-in-2026-10-02, bug/runtime-errors/fibers-forked-outside-atom-builds-must-2026-10-02, bug/runtime-errors/kit-atom-pending-sentinel-must-be-2026-09-28]
---

## Problem
`defineRecord` memoized its `atom(id)` readers in a Map per definition. Two definitions of one type shared the Store slot but returned different atoms, and the strong Map held every id ever read for the process.

## What Didn't Work
A per-definition strong `Map<id, atom>` cache: identity split across definitions, and it outlived every Store.

## Solution
`recordAtom(type, id)` in `packages/model/src/registry.ts` keys readers by `[type, id]` through `Atom.family` (weak). Readers hold no state; the keepAlive slot in the per-Store registry does, so a reclaimed reader reads the same slot.

## Prevention
Test identity across two definitions of one type (`PostAgain.atom('1')` is `Post.atom('1')`), not one definition against itself. Also: `Atom.make` runs an `Option` as an Effect; a derived atom returning `Option` must use `Atom.writable`.
