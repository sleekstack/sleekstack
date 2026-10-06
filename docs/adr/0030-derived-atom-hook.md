# 0030. `useDerivedAtom`: a derived atom in the component's context

## Status

Accepted.

## Context

An Effect atom runs with the store's `context`, and `mount` makes its store with an empty one, so an atom could not use the app's services (a repository). A view and its effect that both needed "the project `projectAtom` names" had to repeat the lookup.

## Decision

`useDerivedAtom(source)` takes a slot (like `useLocal`) holding one derived atom for the instance's whole life. `source` is an Effect, `(get) => Effect`, a generator function `function* (get)` (run as `Effect.gen`) or `(get) => value`. An Effect or generator runs inside `Effect.provide(<the component's context>)`, so its services are the component's; they join the component's requirements and `sleekstack check` reports a missing one. The atom holds a `Result` whose error is only what the Effect yields (no `ScopeError`: the services are provided). The store retains the atom until the instance is removed. `get(atom)` is a dependency when read before the first async step.

## Consequences

- Several readers in one component (the view, a tracked `useEffect`) share one lookup.
- The context is the first run's, and a recompute uses the newest closure.
- It is per instance. A module-level Effect atom with app services still needs the store to carry the layer's context.
