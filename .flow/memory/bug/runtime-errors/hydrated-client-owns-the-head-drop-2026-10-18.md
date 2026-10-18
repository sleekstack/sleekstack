---
title: "Hydrated client owns the head: drop stream late head patches, also after dispose"
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/ui/src/hydrate.ts
tags: [ui, head, stream, hydrate]
problem_type: runtime-error
symptoms: Stale late head patch overwrote client title; adopted title node replaced on fallback swap
root_cause: Inline __sleekHead ran unconditionally; emptied key removed before same-commit takeover
resolution_type: fix
related_to: [bug/runtime-errors/after-commit-work-in-ui-hooks-goes-on-2026-10-10, bug/runtime-errors/captured-context-for-rerun-must-own-2026-10-03, bug/runtime-errors/handler-fibers-must-hold-their-run-2026-10-10, bug/runtime-errors/head-registration-must-be-stable-per-2026-10-18, bug/runtime-errors/reactive-run-scopes-must-follow-2026-10-03, bug/runtime-errors/stream-head-marks-must-follow-boundary-2026-10-18]
---

## Problem
Hydrating a streamed page mid-stream: the stream's inline `__sleekHead` late patches kept writing `document.head` after the client took over. A chunk for a boundary the client had removed, or arriving after the hydrated mount was disposed, overwrote the client's title. Separately, releasing a reactive fallback removed its adopted `<title>` before the content's `Head` registered, so the content created a new element (identity lost; a shared `link` would reload).

## What Didn't Work
Suppressing patches only while the hydration was alive (`dead && head(patch)`): disposal re-enabled the stale patches over a later mount.

## Solution
packages/ui/src/hydrate.ts `landing`: once installed, `__sleekHead` is a no-op; the client's Heads own the head. packages/ui/src/head.ts `documentHead`: an emptied key settles in a microtask and is kept when a Head takes it in the same commit.

## Prevention
For stream/hydration handoffs, test three exits: the boundary lands, the client drops it, the mount is disposed and replaced. In stream tests that hydrate, delete `globalThis.__sleekGone` first: boundary ids repeat across tests.
