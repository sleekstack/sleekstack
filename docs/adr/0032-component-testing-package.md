# 0032. `@sleekstack/testing`: jsdom, Testing Library, global `afterEach`

## Status

Accepted.

## Context

Host components from `@sleekstack/ui` mount through an Effect program and commit React guests, so a test needs React's act environment, a container, disposal between tests, and a way to wait for re-runs and post-commit effects. Writing our own query layer would duplicate Testing Library.

## Decision

`@sleekstack/testing` targets Vitest with the jsdom environment. `render` mounts (or hydrates) into a container on `document.body` inside `act`, and registers one disposal on the runner's global `afterEach`, so the config needs `globals: true`. Queries and events come from Testing Library (`@testing-library/dom`, `@testing-library/user-event`), which the app installs; the package ships none. `flush` ticks inside `act` until the ui renderer's in-flight counter is zero and rejects with `FlushTimeout` after `maxRounds` ticks. The renderer counts every fiber it forks for re-runs, effects, handlers and `Pending` content (`idle` on `@sleekstack/ui/internal`, so no new public name), so a long `Effect.sleep` is awaited and endless work times out even when it never touches the DOM. `mockLayer` builds a Layer from a partial service whose missing methods throw.

## Consequences

- Without `globals: true`, renders are not disposed automatically; call `dispose()`.
- `flush` sees only renderer fibers: a raw `setTimeout` or unforked promise needs `findBy*` / `waitFor`, and an effect that never ends (a long-lived subscription) makes `flush` time out.
- Testing Library stays the only query API, so its docs apply unchanged.
