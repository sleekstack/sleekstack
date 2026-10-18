---
title: "Start client stub must be a form action as it stands, not via adapters"
date: "2026-10-17"
track: bug
category: integration
module: packages/start/src/client.ts
tags: [start, client, form-action, useAction]
problem_type: integration
symptoms: Stub needed an ActionEvent adapter at every action call site
root_cause: Stub accepted only decoded input; tests wrapped it and hid the gap
resolution_type: fix
related_to: [bug/integration/start-request-services-set-cookie-2026-10-17]
---

## Problem
The first start client stub took only the decoded input, so using it as a form action, with useAction or as a router action needed an ActionEvent-to-input adapter at every call site. The task required it to work there unchanged; all three review draws flagged it.

## What Didn't Work
Tests that wrapped the stub in `(e) => Effect.flatMap(decodeForm(e), stub)` passed, but they hid the gap instead of proving the acceptance criterion.

## Solution
`Stub<C>` in packages/start/src/client.ts has two call signatures: the decoded input, and an `ActionEvent` whose `formData` is decoded with the contract's input Schema (failure is a `DecodeError` before any request). The ActionEvent signature is last, so `useAction` and `FormAction` inference pick it.

## Prevention
When an AC says "works unchanged as X", test by passing the value itself to X (a type test assigning it to `FormAction`, plus a runtime test), never through a wrapper.
