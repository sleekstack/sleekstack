---
title: "Fetch handler loopback check must use the peer address, not the Host header"
date: "2026-10-17"
track: bug
category: security
module: packages/runtime/src/devtools.ts
tags: [devtools, security, fetch-handler]
problem_type: security
symptoms: "Remote peer with Host: localhost read the dev-only devtools feed"
root_cause: "Locality derived from request.url hostname, which is client-supplied"
resolution_type: fix
---

## Problem
The devtools feed handler (ported from the Next preset) decided "loopback only" from `new URL(request.url).hostname`. That host comes from the client's `Host` header, so a LAN peer could send `Host: localhost` to a dev server bound on all interfaces and read stack-bearing devtools data.

## What Didn't Work
Adding an optional peer `remoteAddress` that was checked only when given: the default (no address) still trusted the Host header.

## Solution
`packages/runtime/src/devtools.ts`: without `allowRemote`, require the mounting server to pass a loopback `remoteAddress` AND a loopback URL host (the host check also blocks DNS rebinding). Missing peer means 403.

## Prevention
A web-standard `Request` never carries the peer address; any locality or auth check over a fetch handler must take it from the server, fail closed when absent, and have a test for a spoofed Host.
