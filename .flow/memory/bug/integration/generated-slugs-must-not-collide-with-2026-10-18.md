---
title: Generated slugs must not collide with literal sibling routes (articles/feed)
date: "2026-10-18"
track: bug
category: integration
module: apps/realworld/server/articles.ts
tags: [rest, routing, slug]
problem_type: integration
symptoms: Article titled Feed unreachable at /api/articles/feed
root_cause: Slug generator could emit a value equal to a literal route segment matched first
resolution_type: fix
---

## Problem
The REST facade matched the literal route `GET /api/articles/feed` before `GET /api/articles/:slug`, while slug allocation could produce `feed` from an article titled "Feed". That article was unreachable: anonymous readers got 401, signed-in ones got the feed envelope.

## Solution
`withSlug` in `apps/realworld/server/articles.ts` skips reserved slugs (`RESERVED_SLUGS = {'feed'}`), so "Feed" becomes `feed-2`, on create and on title change. A REST test creates "Feed" and fetches it by the returned slug.

## Prevention
When a router has a literal segment beside a parameter at the same position, reserve the literal in whatever generates the parameter's values, and test that every generated value round-trips through its URL.
