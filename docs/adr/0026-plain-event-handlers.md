# 0026. Event handlers: a function, a generator or an Effect

## Status

Accepted. Amends ADR 0024, which made generators valid for components only.

## Context

Every `onXxx` handler had to return an `Effect`, so a one-line setter read `onClick={() => Effect.sync(() => select(id))}`. The wrapper added nothing for handlers with no services, errors or async work.

## Decision

An `on*` prop (not a `defineHandler` value) may be:

- a function returning an `Effect`, as before;
- a function returning nothing: run as a no-op Effect (`Effect.void`). Its errors and requirements are none;
- a generator function (`function*` yielding Effects): run as `Effect.gen`;
- an `Effect` value: re-run on every event; it ignores the event.

Any other return value is a `TypeError`, reported to `onError`. The analyzer reads the same types: a `void` return has no `E` / `R`, a generator's come from what it yields, an Effect value's from its type.

## Consequences

- Plain setters stay plain; a handler that needs a service or can fail still says so in its types, and `sleekstack check` still reports them.
- `() => 42` (a value returned by accident) is still an error, not a silent no-op.
- A plain function that throws is reported to `onError` as before.
