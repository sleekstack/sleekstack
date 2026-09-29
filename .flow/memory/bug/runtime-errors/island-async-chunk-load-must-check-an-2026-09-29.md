---
title: Island async chunk load must check an activation token before creating a root
date: "2026-09-29"
track: bug
category: runtime-errors
module: packages/islands/src/Island.tsx
tags: [islands, hydration, race]
problem_type: runtime-error
symptoms: Island async chunk load must check an activation token before creating a root
root_cause: async import outlived effect cleanup without a liveness check
resolution_type: fix
---

## Problem
Island activation cleared its guard state in the deferred unmount, but the pending chunk import still resolved and created a root on a detached or remounted container: a leaked root, or hydrateRoot twice on the same node.

## Solution
Store the activation promise per container and treat it as the token: on resolve, create the root only if `activations.get(el) === activation` (packages/islands/src/Island.tsx).

## Prevention
Every async step after an effect needs a liveness token; test with a deferred loader that resolves after unmount and remount.
