# 0049. `@sleekstack/kit`, `react`, `next` and `islands` are removed

## Status

Accepted. Built in spec fn-55. Supersedes ADRs 0009, 0010, 0012 and 0019, supersedes ADR 0013 in part (the Next preset), and amends ADRs 0004, 0011 and 0018.

## Context

`@sleekstack/ui` and `@sleekstack/start` replace the React and Next stack: components are Effects, the router and server functions live in `router` and `start`, and the docs site moved off Next (ADR 0048). Keeping `kit`, `react`, `next` and `islands` meant two stacks to maintain, and the Effect-free facade (`kit`) described a second vocabulary for the same graph.

## Decision

- The four packages are deleted: `@sleekstack/kit`, `@sleekstack/react`, `@sleekstack/next` and `@sleekstack/islands`. Their tests, fixtures, docs pages and API reference go with them.
- `@sleekstack/runtime` stays the one framework-agnostic runtime. The Next control-flow classifier and the devtools route handler are gone; the devtools feed is a plain handler in `runtime`. Redirect and NotFound are `redirect` / `notFound` in `@sleekstack/router`.
- The global runtime slot key is bumped to `@sleekstack/runtime/runtime-slot/v3`, so a stale copy of the old slot shape is never reused.
- `@sleekstack/devtools` is rebuilt on `@sleekstack/ui`: `SleekStackDevtools` (graph, scopes, errors, atoms, queries) and `UiPanel` / `uiTrace()` are ui components, with no React.
- `@sleekstack/analyze` reads no kit declarations: the Graph comes from core Layers, `declareLayer` and Modules only (ADR 0011 otherwise stands). The `kit-app` fixture is removed.
- The `evals/` agent harness is deleted: it linked `@sleekstack/kit`. The research note keeps its results as history.
- The showcase keeps eight trees (app count after the removal).

## Consequences

- One public vocabulary: Tag, Layer, Declared Layer, Module, Component, Server Function. The Kit terms leave `CONTEXT.md`.
- Changing a decision recorded by the superseded ADRs needs a new ADR; their text stays as history.
- Users of the removed packages stay on the last release that contained them.
