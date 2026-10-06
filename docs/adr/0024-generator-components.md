# 0024. A component may be a generator function

## Status

Accepted. Relaxes ADR 0001's "users write `Effect.gen`" for components only: Effect-returning components stay valid.

## Context

Every component was `() => Effect.gen(function* () { ...; return yield* (<jsx/>) })`. The wrapper and the `return yield*` carry no information: the framework already runs each component as an Effect.

## Decision

- **Form.** A component may be a `function*`. It `yield*`s Effects (services, atoms, `useLocal`, child components) and returns its element: a JSX expression, an `Effect<Node>` or a plain `Node`. `return yield* (<jsx/>)` still works.
- **Runtime.** The renderer calls the component; a result that is a generator (and not an Effect) is run as `Effect.gen`, and an Effect it returns is run in turn. Everything else (instances, memoization, slots, keyed rows, hydration, streaming) sees an ordinary component Effect.
- **Types.** `JSX.ElementType` and `ComponentResult` accept `Generator<YieldWrap<Effect>, Effect<Node> | Node>`. The returned Effect's `E` / `R` and every yielded Effect's `E` / `R` are the component's.
- **Analyzer.** `E` / `R` of a generator component come from the generator type (yields plus return), including Tags and other Effect-shaped values (read from their variance struct). Children are the elements it returns and the components it `yield*`s. `ConditionalSlot` applies to a component's own `function*` body as it does to `Effect.gen`.
- Effect-returning components (and `Effect.gen` inside them) are unchanged.

## Consequences

- A component reads as a plain generator; no wrapper, no `return yield*`.
- A helper generator that is not a component (returns neither an Effect nor a Node) is not accepted as one by the analyzer; `useLocal` in it is a `ConditionalSlot`.
- A generator passed as a component is single-use per call, as an Effect created by the call is. Components must not be written to be re-iterated.
