---
title: Derived Draft input type needs the transformation's to Schema on the field type
date: "2026-10-18"
track: bug
category: integration
module: packages/model/src/commit.ts
tags: [model, draft, transformation, types]
problem_type: integration
symptoms: Draft of a field(...) typed as to's Type while it holds to's Encoded
root_cause: TransformedField alias dropped To
resolution_type: fix
---

## Problem
A record's derived Draft holds a `field(...)` transformation's `to` input (its Encoded), but `TransformedField` was a plain `Schema.Schema` alias that dropped `To`, so the Draft's type guessed `to`'s Type. With `to: Schema.NumberFromString` the Draft held `"12"` typed `number`. The same review found a save response with another id written into the requested slot, and derived Draft seeding with `encodeSync` that throws for Service-backed field Schemas.

## What Didn't Work
Typing the input as the field's Type whenever its Encoded admits `undefined`: correct only when `to`'s Type equals its Encoded.

## Solution
`TransformedField` is an interface carrying `readonly to: To` (true at runtime: a `transformOrFail` keeps `.to`), and `RecordInput` maps a field with `undefined` in its Encoded to `Encoded<To>` (packages/model/src/commit.ts). `commit` fails `SaveResponseError` when the hydrated id differs; `record.useDraft` is `never` when `Schema.Struct.Context<F>` is not `never`.

## Prevention
A type that drops a generic parameter cannot be recovered downstream: keep Schema parts a consumer needs on the interface. Test a transformation whose `to` Type differs from its Encoded.
