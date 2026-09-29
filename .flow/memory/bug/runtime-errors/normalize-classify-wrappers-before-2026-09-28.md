---
title: "normalize: classify wrappers before generic cause unwrap"
date: "2026-09-28"
track: bug
category: runtime-errors
module: packages/kit/src/errors.ts
tags: [normalize, errors]
problem_type: runtime-error
symptoms: "normalize: classify wrappers before generic cause unwrap"
root_cause: generic unwrap ordered before specific wrapper checks
resolution_type: fix
---

## Problem
A generic `Error.cause is Cause` unwrap in kit `normalize` ran before LayerFailure/CleanupFailure checks, so wrappers holding a Cause lost their LayerFailed/CleanupFailed code.
## Solution
Classify specific wrappers and tagged graph errors first; unwrap only a plain `Error` (constructor === Error) whose cause is a Cause, last (packages/kit/src/errors.ts).
## Prevention
Table-test normalize with wrappers whose inner cause is itself an envelope.
