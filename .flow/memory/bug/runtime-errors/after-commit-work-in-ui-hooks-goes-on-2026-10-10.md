---
title: "After-commit work in ui hooks goes on frame effects, not timers"
date: "2026-10-10"
track: bug
category: runtime-errors
module: packages/ui/src/reactive.ts
tags: [ui, slots, deferred, commit]
problem_type: runtime-error
symptoms: "After-commit work in ui hooks goes on frame effects, not timers"
root_cause: setTimeout and a first-run closure stood in for the renderer's post-commit queue
resolution_type: fix
---

## Problem
useDeferredAtom first followed its source with a store subscription plus setTimeout(0): not tied to commit (an async re-run could commit after the deferred value moved) and the closure pinned the first source atom.

## Solution
The hook reads the source through useAtomValue (instance re-runs on change) and pushes `store.set(deferred, store.get(source))` onto `f.effects`, the renderer's post-commit queue (packages/ui/src/reactive.ts useDeferredAtom). Dropped runs never copy; the current run's source is always used.

## Prevention
"After commit" in ui means frame effects, never a timer. Test with a gated async re-run and a source swap.
