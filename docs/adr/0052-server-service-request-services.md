# 0052. Server Service implementations use request services; realworld moves to Server Services

## Status

Accepted. Amends ADR 0051 (resolves its parked decision on request services; adds two type shapes to the type-to-Schema subset). Built in spec fn-67.

## Context

ADR 0051 left request services out of v1: a contract method has `R = never`, and a method that needed `Cookies` or `Request` stayed a `serverFn`. The realworld app shows the cost. All 20 of its server operations use the session cookie (register and login set it, logout deletes it, the rest run as its viewer), so it still has 20 hand-written contracts, a `viewerFn` wrapper, an id map and a `ServerFunctions` Tag that picks the client or the in-place function by environment.

## Decision

- **Contracts stay `R = never`.** The contract is what the browser sees, and the browser has no request. Putting request services in the contract's `R` would make the browser Layer drop them and the Tag's type lie in the browser.
- **`implement(Tag, methods)` builds the implementation Layer.** It comes from `@sleekstack/start` (the server entry, never the client subpath). Each method may require `Request`, `Cookies` and `ResponseHeaders` and nothing else; any other requirement is a type error at the call. It returns `Layer<Tag>`, so the server layer and `sleekstack check`'s missing-implementation check are unchanged.
- **The services are provided per call, never at Layer build time.** On the wire the endpoint already runs the call in a Request Scope that provides them. In process, a loader calling `yield* Tag` while a page renders runs on the request fiber's runtime, which provides the same services (ADR 0039). A viewer lookup reads the cookie inside the method, per call.
- **Type subset gains two shapes.** A `Schema.TaggedError` subclass is a valid error: the class is its own Schema, so the generated code names the class with no `taggedError` wrapper. A string-keyed record is a supported kind, printed as `Schema.Record`. Other index signatures stay `ServerServiceTypeNotSerializable`.
- **Realworld becomes three Server Services** (`IdentityApi`, `ArticlesApi`, `CommentsApi`) with `*.server.ts` implementations, and loses its contracts, `viewerFn`, id map, `ServerFunctions` Tag and its two Layers. Wire ids become `<Tag>.<method>`; the REST handlers are unaffected.

## Alternatives rejected

- **Request services in the contract's `R`.** See above: the type would lie in the browser instead of where the in-place layer already hides it.
- **Keep realworld on `serverFn`.** Nothing there qualifies for a Server Service without this change, and the hand-written layer it carries is exactly what ADR 0051 set out to remove.
- **A cookie argument passed by the generated client.** Cookies are HTTP, not input, and the `HttpOnly` session cookie is unreachable from scripts by design.

## Consequences

- An implementation's requirement on request services is checked at `implement`, but the Tag's own type does not show it, so a caller cannot see that a method reads the cookie. The same is true of the in-place layer it replaces.
- A Server Service method and a `serverFn` can both use request services; the choice between them stays the one in ADR 0051 (types versus explicit Schemas).
- Whether `ResponseHeaders` writes other than `Set-Cookie` from an in-process loader call reach the page response is settled while building spec fn-67 and recorded here when known.
