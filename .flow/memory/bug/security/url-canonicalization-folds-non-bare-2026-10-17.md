---
title: URL canonicalization folds non-bare origins into a valid origin
date: "2026-10-17"
track: bug
category: security
module: packages/start/src/origin.ts
tags: [url, origin, validation]
problem_type: security
symptoms: allow-list entries with dot segments or empty credentials passed validation
root_cause: validation ran after new URL() canonicalized the entry
resolution_type: fix
---

## Problem
Validating an allow-list origin with `new URL(entry)` and then checking `url.href === url.origin + '/'` accepts entries that are not bare origins: URL canonicalization folds `https://a.test/x/..`, `https://a.test/%2e`, `https://a.test/.`, `https://@a.test` and surrounding whitespace into `https://a.test/`.

## What Didn't Work
Checking the parsed URL alone: by then the dot segments, empty credentials and padding are gone.

## Solution
Check the raw entry's syntax first (`/^[a-z][a-z\d+.-]*:\/\/[^/?#@\\\s]+\/?$/i`), then parse with `URL` to normalize case and default port (packages/start/src/origin.ts `normalizeOrigin`).

## Prevention
When a validator relies on a parser's canonical form, test inputs the parser rewrites (dot segments, percent-encoded dots, empty userinfo, whitespace), not just obviously malformed ones.
