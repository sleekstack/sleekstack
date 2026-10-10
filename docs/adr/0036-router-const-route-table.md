# 0036. `@sleekstack/router`: a const route table, not TanStack router-core

## Status

Accepted. Supersedes the plan in specs fn-28 (`ui-router` over TanStack router-core) and fn-32 (its loaders), which were never built.

## Context

Apps on the ui host have no router. The earlier plan wrapped TanStack router-core and leaned on its generator (`@tanstack/router-generator`) for typed routes. That brings a second reactivity model, a codegen step, and a runtime dependency into every routed app, while the rest of SleekStack expresses context as Layers and async work as Effects. TypeScript template-literal types can parse params out of a path string, so typed routes do not need a generated tree (chart fn-42, D1 to D4).

## Decision

- **Package.** The router is `@sleekstack/router`, a separate package. `@sleekstack/ui` does not depend on it, which keeps ui within its size budget (ADR 0022); the boundary follows ADR 0025: the router integrates through ui's public `Transfer` extension and `@sleekstack/ui/internal` hooks, never the other way.
- **Routes.** A route table is a `const` object of path strings. Params are inferred from the path string at the type level; there is no code generation. The matched route is provided to the page as a Layer service.
- **Data.** A loader is an Effect run under the `Pending` the router wraps around the page and read with `useLoader`. An action takes the same forms as a form action (ADR 0033). Loader data is serializable and reaches the client through `Transfer`.
- **No TanStack.** `@sleekstack/router` has no dependency on `@tanstack/router-core` or its generator. The Vite plugin (fn-29) turns route files into the same const table instead of running TanStack's generator.

## Consequences

- Typed params come from the path string alone; a route file and a hand-written table produce the same types.
- Redirect, not-found, history and the server handler are implemented in the router rather than inherited from TanStack, with the fn-32 scope carried into spec fn-50.
- Redirect and not-found are tagged failures (`Redirect`, `NotFound`) that the router's entries treat as control flow: `handle` runs a page's loaders before rendering, so it answers 302 / 404 / the loader error's status, and `startRouter` navigates or shows the not-found page, also for an action's failure. Redirects stop after a fixed bound (`RedirectLoop`). A redirect raised by a loader the page reads but does not declare on its route reaches the renderers as an ordinary failure.
- Features TanStack provides beyond this (search-param schemas, route masking, devtools) are not available until built here.

## Rejected

- TanStack router-core under a ui adapter: a second state model and an extra runtime dependency for every routed app.
- A codegen route tree: an extra build step that the template-literal types make unnecessary.
