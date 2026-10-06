# 0029. Generator effects follow the atoms they read

## Status

Accepted. Extends ADR 0027 and ADR 0028.

## Context

`useEffect(fn, deps)` needs the caller to list its dependencies, and a component run already tracks the atoms it reads. Effects could do the same.

## Decision

When `fn` is a generator function, `useEffect` runs it after the commit as `Effect.gen`, in its own `Scope`, with the component's context, and a `Collector` of its own: `yield* useAtomValue(a)` records `a`. The recording is per `yield*`, so a read after an async step is tracked too.

- A change to a recorded atom (batched into one microtask) ends the run (interrupt, scope closed: its finalizers are the cleanup, and they finish) and starts it again. The atoms stay held until the effect ends for good, because between runs nothing else holds them and an idle atom is reset.
- The component's own runs do not restart it. They refresh the closure it re-runs from, so an atom-driven re-run sees the latest props.
- `deps`, when given, restart it in place when they change. Plain values (props) are not tracked; list them.
- Cleanup is `Effect.addFinalizer` / `acquireRelease`; `Effect.sync` finalizers cover plain code. A failure goes to `onError`.
- `useEffect` has a second overload typing the generator's yields: its requirements join the component's, `Scope` is removed.
- Slot hooks (`useLocal`, `useEffect`, `useRef`) inside an effect get a throwaway frame; they belong to components.

## Consequences

- An effect that reads `projectAtom` needs no `deps`; the ui-demo title effect is the example.
- An effect that fails on a new atom value (e.g. a repository lookup) reports to `onError` unless it handles the failure itself.
- An effect reads its dependencies through atoms only: a value that exists only as a prop needs `deps`.
