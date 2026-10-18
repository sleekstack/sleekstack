---
title: "Stream head marks must follow boundary ownership, not a fallback snapshot"
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/ui/src/stream.ts
tags: [ui, stream, head, pending]
problem_type: runtime-error
symptoms: Inner boundary's title survives after the outer content replaces its fallback
root_cause: Fallback head marks captured once at shell time miss marks added by nested boundaries resolving later
resolution_type: fix
related_to: [bug/runtime-errors/after-commit-work-in-ui-hooks-goes-on-2026-10-10, bug/runtime-errors/captured-context-for-rerun-must-own-2026-10-03, bug/runtime-errors/handler-fibers-must-hold-their-run-2026-10-10, bug/runtime-errors/head-registration-must-be-stable-per-2026-10-18, bug/runtime-errors/reactive-run-scopes-must-follow-2026-10-03]
---

## Problem
`renderToStream` removed a boundary's fallback head tags by a snapshot taken when the fallback was serialized. A Pending nested in that fallback that resolved later added marks the snapshot missed, so after the outer content replaced the fallback the inner title stayed in `document.head`.

## What Didn't Work
A per-boundary list of the fallback's marks: it is fixed at shell time and cannot see marks that nested boundaries add afterwards.

## Solution
Ownership contexts in packages/ui/src/stream.ts: each mark is owned by the fallback (`id`) or content (`c:id`) context it was serialized in, and each context records the context it sits in. A mark is live while no context up its chain is retired (a fallback once its content swaps in, content once it fails to serialize). The head is computed from live marks only.

## Prevention
Test streamed head in both completion orders of nested boundaries (inner first, outer first).
