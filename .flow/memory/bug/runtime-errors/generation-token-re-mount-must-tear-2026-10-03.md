---
title: "Generation-token re-mount must tear down before await, recheck after build"
date: "2026-10-03"
track: bug
category: runtime-errors
module: packages/ui/src/dom.ts
tags: [generation-token, remount, react-roots]
problem_type: runtime-error
symptoms: "Generation-token re-mount must tear down before await, recheck after build"
root_cause: teardown deferred until new mount succeeded
resolution_type: fix
---

## Problem
mount bumped the per-container generation before awaiting the Effect but tore down old roots only on success, so a rejecting/pending re-mount orphaned the previous DOM and roots (old handle dispose became a no-op).

## Solution
Tear down at mount start (packages/ui/src/dom.ts), build into generation-local roots, recheck generation after build (guest onError can start a newer mount) and unmount local roots if superseded.

## Prevention
Test a rejecting re-mount and a re-entrant mount from onError.
