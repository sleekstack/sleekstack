---
title: Head registration must be stable per instance and adopt existing head tags
date: "2026-10-18"
track: bug
category: runtime-errors
module: packages/ui/src/head.ts
tags: [ui, head, dom]
problem_type: runtime-error
symptoms: Updated Head jumps mount order; shell title wins; wrong document patched
root_cause: "Effect re-add per content change, append-only patch, global document"
resolution_type: fix
related_to: [bug/runtime-errors/after-commit-work-in-ui-hooks-goes-on-2026-10-10, bug/runtime-errors/captured-context-for-rerun-must-own-2026-10-03, bug/runtime-errors/handler-fibers-must-hold-their-run-2026-10-10, bug/runtime-errors/portal-content-needs-its-own-host-never-2026-10-10, bug/runtime-errors/reactive-run-scopes-must-follow-2026-10-03]
---

## Problem
The first `Head` DOM patch re-registered a Head's tags on every content change (useEffect add/cleanup), always appended new elements, and patched the global `document`. Review found: updating an earlier sibling Head made it beat a later-mounted one; a shell `<title>` already in the page kept `document.title`; mounting into another document patched the wrong head; mixed-case attribute names bypassed key dedupe.

## What Didn't Work
Registering in one `useEffect(() => sink.add(tags), [sig])`: the cleanup/re-add moves the Head to the end of mount order and replaces unchanged link elements.

## Solution
packages/ui/src/head.ts: one registration per Head instance held in a `useRef` (created in the content effect, removed by a `[]` effect's cleanup), updated in place via `set`. `documentHead(doc)` claims a matching existing head tag per key and restores its snapshot when the key empties. `mount` (dom.ts `start`) provides `HeadSink` for `container.ownerDocument`. Head attribute names are lowercased before keying.

## Prevention
For any after-commit registry keyed by mount order, keep identity stable across re-runs; test against a document that already has the managed tags, and a second document.
