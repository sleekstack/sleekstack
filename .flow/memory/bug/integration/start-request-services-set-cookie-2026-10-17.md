---
title: "Start request services: Set-Cookie identity is name+path+domain, keep on 500"
date: "2026-10-17"
track: bug
category: integration
module: packages/start/src/services.ts
tags: [start, cookies, set-cookie]
problem_type: integration
symptoms: Set-Cookie for the same name at another path dropped; staged cookies lost on a 500
root_cause: Cookies keyed by name only and the error path skipped response finishing
resolution_type: fix
---

## Problem
The first `@sleekstack/start` request services lost response mutations: `Set-Cookie` lines were keyed by cookie name only (a name set at `/` and `/admin` collapsed to one), and the 500 path returned a bare response, dropping cookies and headers staged by middleware before the defect. `Domain` accepted any printable text and an invalid `Expires` date was emitted as `Invalid Date`.

## Solution
`packages/start/src/services.ts`: key staged cookies by `name;path;domain`, validate `Domain` with a host-label grammar and `Expires` with `Number.isNaN(getTime())` (new `InvalidCookie` part `expires`). `packages/start/src/start.ts`: every response, the 500 included, goes through `services.finish`.

## Prevention
A response-mutation service needs a test where the mutation is staged before a failure, and a test for two cookies sharing a name at different paths.
