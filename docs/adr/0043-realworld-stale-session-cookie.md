# 0043. The RealWorld app: a stale session cookie reads as signed out

## Status

Accepted. Amends 0042 (its "a bad or expired JWT is 401 everywhere" rule, for the session cookie only).

## Context

A session cookie goes stale when the secret rotates, the database is reset or its user is deleted. Under 0042 every server function failed `Unauthorized` on it, while the `viewer` loader read it as signed out: the header said "Sign in" while every page body failed, and nothing cleared the cookie.

## Decision

- A session cookie whose JWT is bad, expired, or names a missing user is cleared (`Set-Cookie` with `Max-Age=0`) and the request runs as an anonymous viewer. Read-only server functions answer as for anyone signed out; one that needs a viewer fails `Unauthorized` through its own check.
- The session cookie is `Secure` when `NODE_ENV` is `production` or the request is https; dev over http keeps working.
- The REST facade keeps 0042's rule: a bad `Authorization: Token` is 401 on every route.

## Consequences

- A stale cookie costs one request: the next one carries no cookie.

## Rejected

- Clearing the cookie but still failing every function: the page bodies would fail once more before the browser drops it.
