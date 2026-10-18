---
title: Vite plugin memo must reset per build; ws error buffer replays stale overlay
date: "2026-10-18"
track: bug
category: integration
module: packages/ui-vite/src/analyze.ts
tags: [vite, plugin, overlay, watch]
problem_type: integration
symptoms: watch rebuilds reuse stale analyzer result; fixed error reappears for a late browser
root_cause: lifetime memo on a shared plugin; Vite buffers error payloads with no ws clients
resolution_type: fix
related_to: [bug/integration/node-loaded-packages-vite-plugins-need-2026-10-18]
---

## Problem
The Vite plugin's analyzer hook memoized its result for the plugin's lifetime (to share one run across build environments), so `vite build --watch` and repeated programmatic builds reused stale diagnostics. In dev, an error sent through `server.ws.send` with no browser connected is buffered by Vite and replayed to the next browser even after the error was fixed; an empty `update` does not clear that buffer.

## What Didn't Work
`built ??= attempt()` with `sharedDuringBuild: true` and nothing resetting it; sending overlay errors unconditionally.

## Solution
packages/ui-vite/src/analyze.ts: reset the memo in `configResolved` and `watchChange`; send overlay messages only when `server.ws.clients.size` is non-zero and replay the current result in a `connection` handler.

## Prevention
Any memo in a shared Vite plugin needs a reset tied to a build cycle (configResolved / watchChange). Never rely on `ws.send` for state that can become stale: Vite buffers `error` / `full-reload` payloads while no client is connected. Tests: two builds on one plugin instance, a watch rebuild, and a fix-before-connect overlay case.
