---
title: Portal content needs its own host; never patch a shared container directly
date: "2026-10-10"
track: bug
category: runtime-errors
module: packages/ui/src/dom.ts
tags: [portal, dom, reconcile]
problem_type: runtime-error
symptoms: Portal content needs its own host; never patch a shared container directly
root_cause: patchChildren place() assumes it owns the parent's child list
resolution_type: fix
related_to: [bug/runtime-errors/generation-token-re-mount-must-tear-2026-10-03, bug/runtime-errors/reactive-run-scopes-must-follow-2026-10-03]
---

## Problem
Portal children were built straight into the shared target and patched with the target as parent: `place()` assumes it owns the parent's whole child list, so sibling portals or foreign children reorder; build also wrote live DOM during plan phase.

## Solution
Each portal gets its own `<sleek-portal>` host built off-DOM, appended on commit via `env.post.refs`; patch reconciles inside the host and revalidates `container.isConnected` (packages/ui/src/dom.ts).

## Prevention
Any node rendering outside its Live's parent needs its own owned host and commit-time attach; test two portals sharing one container.
