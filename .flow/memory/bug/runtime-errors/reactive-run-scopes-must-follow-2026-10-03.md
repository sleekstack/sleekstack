---
title: "Reactive run scopes must follow committed DOM, not rerun completion"
date: "2026-10-03"
track: bug
category: runtime-errors
module: packages/ui/src/dom.ts
tags: [ui, reactive, scope, lifecycle]
problem_type: runtime-error
symptoms: "Reactive run scopes must follow committed DOM, not rerun completion"
root_cause: rerun closed the previous scope itself before the renderer validated and committed the new DOM
resolution_type: fix
related_to: [bug/runtime-errors/captured-context-for-rerun-must-own-2026-10-03, bug/runtime-errors/external-app-scope-close-must-wait-for-2026-09-29, bug/runtime-errors/fibers-forked-outside-atom-builds-must-2026-10-02, bug/runtime-errors/generation-token-re-mount-must-tear-2026-10-03]
---

## Problem
Reactive re-runs owned their Provider scopes inside the Effect (a successful run closed the previous one), so the renderer could not keep scopes aligned with committed DOM: rejected swaps freed live DOM's resources, discarded/stale results and fallbacks leaked scopes, and atoms read during an async run could be dropped (reset) before subscription.

## Solution
packages/ui/src/dom.ts + reactive.ts: Reactive nodes carry their run scope; untracked runs and fallbacks carry theirs via a fresh Fragment wrapper (`runScopes`). The renderer closes the previous scope only after a committed swap, drops every scope of a rejected/stale result, retains read atoms for the run's scope, and re-runs if a read value moved before subscribing. Swaps are transactional; subscription epochs drop stale queued changes.

## Prevention
Resource lifetime follows DOM ownership, never Effect completion. Tests: packages/ui/src/__tests__/reactive-dom.test.ts.
