---
title: Partial updates must write only given columns across an async hash
date: "2026-10-18"
track: bug
category: data
module: apps/realworld/server/identity.ts
tags: [sqlite, concurrency, lost-update]
problem_type: data
symptoms: "Concurrent password and bio updates: bio reverted to null"
root_cause: Row snapshot written back after awaiting scrypt
resolution_type: fix
---

## Problem
`updateUser` read the whole user row, awaited scrypt for a new password, then wrote every column back from that snapshot. A bio update that finished during hashing was reverted to the old value.

## What Didn't Work
`UPDATE users SET email = ?, username = ?, password_hash = ?, bio = ?, image = ?` with `row.x` fallbacks for absent fields.

## Solution
Build the SET clause from only the supplied fields (apps/realworld/server/identity.ts, `updateUser`), so omitted columns are never written.

## Prevention
Any read-then-write that yields (async hash, network) between the read and the write must write only changed columns. Test it with two concurrent partial updates via `Effect.all(..., { concurrency: 'unbounded' })`.
