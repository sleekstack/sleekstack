## Goal & Context
<!-- scope: business -->

Server Services (ADR 0051) removed hand-written contracts, ids and registries for services that need no request state. The realworld app still carries 20 hand-written contracts (identity, articles, comments), a `viewerFn` wrapper, an id map, a `ServerFunctions` Tag with a client and an in-place Layer, and loaders that call `(yield* ServerFunctions)(contract)(input)`. Every one of those functions needs request services: register and login set the session cookie, logout deletes it, the rest run as the session cookie's viewer. Server Service v1 cannot express that, which is the decision ADR 0051 parked.

Goal: realworld has no contracts. Its server operations are three Server Services (identity, articles, comments) whose implementations are Layers in `*.server.ts` files and whose methods may use the request services (`Request`, `Cookies`, `ResponseHeaders`). Pages and loaders call `yield* <Tag>` with the same code in the browser and on the server.

This needs two enablers first: request services in Server Service implementations, and two type shapes the realworld contracts use that the type-to-Schema subset does not accept yet (Schema-built tagged errors, string-keyed records).

## Architecture & Data Models
<!-- scope: technical -->

- **Request services in an implementation.** A contract method keeps `R = never`: the contract is what the browser sees and the browser has no request. An implementation Layer is built with `implement(Tag, methods)` from `@sleekstack/start` (the server entry, not the client subpath). Its methods may require `Request`, `Cookies` and `ResponseHeaders` and nothing else; anything else in `R` is a type error at the `implement` call. The result is `Layer<Tag>`.
- **Where the services come from.** On the wire, the endpoint already runs each call in a Request Scope that provides them, so a method's `Cookies` is that request's jar and a `Set-Cookie` it writes goes out with the response. In process (a loader calling `yield* Tag` during a page render), the page runs on the request fiber's runtime, which provides the same services (ADR 0039). The Tag's own type hides the requirement, as the realworld `ServerFunctionsInPlace` layer already does by hand.
- **Type subset additions.** A `Schema.TaggedError` subclass is a valid error: the class is its own Schema, so the generated code names the class and no `taggedError` wrapper is emitted. A string-keyed record (`Record<string, T>` or `{ readonly [key: string]: T }`) is a supported kind, printed as `Schema.Record`. Every other index signature stays `ServerServiceTypeNotSerializable`.
- **Realworld services.** Three Tags, ids `IdentityApi`, `ArticlesApi`, `CommentsApi`, so wire ids read `IdentityApi.login` and so on. Contracts and error classes stay client-safe in the modules' application layer; implementations move to `*.server.ts` files under `server/`. The identity Tag carries register, login, logout, current user, update, profile, follow and unfollow; articles carries list, feed, get, create, update, delete, favorite, unfavorite and tags; comments carries list, add and delete.
- **Removed from realworld.** The 20 contract objects, `viewerFn`, the `byId` map, the `ServerFunctions` Tag, its client and in-place Layers, and the `functions` list in the server entry.
- **Wire ids change.** `users.login` becomes `IdentityApi.login`. The RealWorld REST API (`/api/*`, served by the app's handlers) is separate and unaffected.

## API Contracts
<!-- scope: technical -->

- `implement(Tag, methods)` in `@sleekstack/start`: `methods` is the Tag's contract with each method's `R` allowed to be a subset of `Request | Cookies | ResponseHeaders`; returns `Layer<Tag>`.
- `callService` in `@sleekstack/testing` provides the request services per call as `callServerFn` does, and takes the implementation Layer built by `implement`.
- No new `AnalyzeCode`. The two new type shapes extend the existing subset; `ServerServiceMethodShape` still requires `R = never` in a contract.

## Edge Cases & Constraints
<!-- scope: technical -->

- A method that needs a service outside the three request services is a type error at `implement`; it is not silently dropped to a defect at call time.
- A cookie written by an implementation during an in-process loader call lands on the page response, as it does for a wire call.
- The viewer lookup (`asViewer`) reads the session cookie through `Cookies` per call, never at Layer build time: a Layer is built once, a request is per call.
- Contracts that return the viewer's token still keep it in the cookie only (the `Account` shape omits it); the migration does not widen any success shape.
- `Redirect` and `NotFound` the router owns stay available to an implementation only when the contract's error union lists them. Realworld's own `NotFound` is its Schema error, unrelated to the router's.
- Behavior is pinned by the existing realworld tests (auth, feed, article, server) and `pnpm --filter realworld check`; they change only where they construct the `ServerFunctions` Layer.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A Server Service implementation built with `implement` can read and write the request's cookies and read the request, on a wire call and on an in-process call made while a page renders. Errors: a method requiring a service other than `Request | Cookies | ResponseHeaders` is a type error at `implement`; a cookie value outside the cookie grammar fails as `InvalidCookie` does for a Server Function.
- **R2:** The type-to-Schema subset accepts a `Schema.TaggedError` subclass as an error (decoding back into the class) and a string-keyed record, each round-tripping through the wire in a test. Errors: a non-string key, a numeric or template-literal index signature, and a record value outside the subset stay `ServerServiceTypeNotSerializable` with file and line.
- **R3:** Realworld declares identity, articles and comments as Server Services with `*.server.ts` implementations, and contains none of the 20 contract objects, `viewerFn`, the id map, the `ServerFunctions` Tag, or the `functions` list. Errors: no error surface beyond R1 and R2.
- **R4:** Every realworld page and loader that called a contract calls `yield* <Tag>` instead, and the existing realworld tests pass with their layers built from the generated `virtual:sleek/server` Layer or the clients of the registry entries. Errors: a failure the contract does not declare stays an opaque 500 on the wire and a defect in process, as before.
- **R5:** `pnpm --filter realworld check` and `sleekstack check` pass on realworld, including the missing-implementation check for the three Tags, and the client bundle holds no `*.server.ts`. Errors: a `*.server.ts` import reachable from the browser entry fails the build, as in ADR 0051.
- **R6:** ADR 0052 is in the index and records request services in implementations, the two type shapes, and the realworld migration; CONTEXT.md's Server Service entry names `implement`; the docs guide covers request services. No error surface beyond the docs build failing on a broken example.

## Quick commands
<!-- scope: technical -->

```bash
pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=@sleekstack/analyze --filter=@sleekstack/ui-vite --filter=sleekstack
pnpm turbo run test typecheck --filter=realworld && pnpm --filter realworld check
```

## Early proof point

Task fn-67-realworld-on-server-services-request.1 validates the core approach: an implementation built with `implement` reading and writing cookies on both the wire path and the in-process path. If it fails, re-evaluate how the request services reach an in-process call before touching realworld (tasks .3 onward).

## Boundaries
<!-- scope: business -->

- Not changing the wire, the registry, `serverFn` or `client(contract)`; a Server Function keeps working beside a Server Service.
- Not putting request services in a contract method's `R`: the contract is what the browser sees.
- Not supporting any service beyond `Request`, `Cookies` and `ResponseHeaders` in an implementation, and not streaming results.
- Not touching the RealWorld REST handlers (`/api/*`) or the database layer.
- Not migrating showcase's `serverFn` demo or other apps.

## Decision Context
<!-- scope: both -->

Rejected: **request services in the contract's `R`**. The browser Layer would have to drop them and the Tag's type would lie in the browser instead of on the server, where the in-place Layer already hides them. **Keep realworld on `serverFn`** (nothing there qualifies, all 20 use the cookie). **A per-method `Cookies` argument** passed by the generated client: cookies are HTTP, not input, and the HttpOnly session cookie is unreachable from scripts by design.

Parked unknowns:

- Whether `ResponseHeaders` writes (beyond `Set-Cookie`) from an in-process loader call reach the page response. Resolved while building R1; record the answer in ADR 0052.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | A Server Service implementation built with `implement` can read and write the request's cookies and read the request, on a wire call and on an in-process call made while a page renders. Errors: a method requiring a service other than `Request \| Cookies \| ResponseHeaders` is a type error at `implement`; a cookie value outside the cookie grammar fails as `InvalidCookie` does for a Server Function. | fn-67-realworld-on-server-services-request.1 | — |
| R2 | The type-to-Schema subset accepts a `Schema.TaggedError` subclass as an error (decoding back into the class) and a string-keyed record, each round-tripping through the wire in a test. Errors: a non-string key, a numeric or template-literal index signature, and a record value outside the subset stay `ServerServiceTypeNotSerializable` with file and line. | fn-67-realworld-on-server-services-request.2 | — |
| R3 | Realworld declares identity, articles and comments as Server Services with `*.server.ts` implementations, and contains none of the 20 contract objects, `viewerFn`, the id map, the `ServerFunctions` Tag, or the `functions` list. Errors: no error surface beyond R1 and R2. | fn-67-realworld-on-server-services-request.3, fn-67-realworld-on-server-services-request.4, fn-67-realworld-on-server-services-request.5 | — |
| R4 | Every realworld page and loader that called a contract calls `yield* <Tag>` instead, and the existing realworld tests pass with their layers built from the generated `virtual:sleek/server` Layer or the clients of the registry entries. Errors: a failure the contract does not declare stays an opaque 500 on the wire and a defect in process, as before. | fn-67-realworld-on-server-services-request.3, fn-67-realworld-on-server-services-request.4, fn-67-realworld-on-server-services-request.5 | — |
| R5 | `pnpm --filter realworld check` and `sleekstack check` pass on realworld, including the missing-implementation check for the three Tags, and the client bundle holds no `*.server.ts`. Errors: a `*.server.ts` import reachable from the browser entry fails the build, as in ADR 0051. | fn-67-realworld-on-server-services-request.3, fn-67-realworld-on-server-services-request.4, fn-67-realworld-on-server-services-request.5 | — |
| R6 | ADR 0052 is in the index and records request services in implementations, the two type shapes, and the realworld migration; CONTEXT.md's Server Service entry names `implement`; the docs guide covers request services. No error surface beyond the docs build failing on a broken example. | fn-67-realworld-on-server-services-request.5 | — |

