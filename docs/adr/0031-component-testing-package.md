# 0031. `@sleekstack/testing`: jsdom, Testing Library, global `afterEach`

## Status

Accepted.

## Context

Host components from `@sleekstack/ui` mount through an Effect program and commit React guests, so a test needs React's act environment, a container, disposal between tests, and a way to wait for re-runs and post-commit effects. Writing our own query layer would duplicate Testing Library.

## Decision

`@sleekstack/testing` targets Vitest with the jsdom environment. `render` mounts (or hydrates) into a container on `document.body` inside `act`, and registers one disposal on the runner's global `afterEach`, so the config needs `globals: true`. Queries and events come from Testing Library (`@testing-library/dom`, `@testing-library/user-event`), which the app installs; the package ships none. `flush` ticks inside `act` until a few consecutive ticks leave the DOM unchanged (default three 5 ms ticks) and rejects with `FlushTimeout` otherwise. `mockLayer` builds a Layer from a partial service whose missing methods throw.

## Consequences

- Without `globals: true`, renders are not disposed automatically; call `dispose()`.
- `flush` judges settledness by the DOM, not the scheduler: longer async work needs `findBy*` / `waitFor`.
- Testing Library stays the only query API, so its docs apply unchanged.
