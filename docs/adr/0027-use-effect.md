# 0027. `useEffect`: an effect tied to an instance

## Status

Accepted. Amended by ADR 0028: effects run after the DOM is committed.

## Context

A component body runs again whenever an atom it reads changes, and each run's `Scope` closes when a newer run replaces it. So an effect written in the body is per run. There was no way to say "when this instance appears, or when this value changes, and clean up when it goes away or changes again", the shape React developers know as `useEffect`.

## Decision

`useEffect(fn, deps?)` takes a slot in the instance (like `useLocal`). The slot holds one mutable record: whether `fn` ran, its last `deps`, and its cleanup. On each run:

- `fn` runs when it never ran, when `deps` is omitted, or when `deps` differ (`Object.is`, element by element) from the last run's. `[]` therefore runs once.
- Before `fn` runs again, its previous cleanup runs.
- A release in the instance's `Slots.releases` runs the last cleanup when the instance is removed, when a dropped first run's slots are disposed, or when the mount is disposed; it cascades to child instances.

`fn` is an Effect itself, or a function returning nothing, a cleanup function, or an Effect. An Effect runs as a fiber with the run's context and its own `Scope` (`Effect.addFinalizer` / `acquireRelease` work); its cleanup interrupts the fiber and closes the scope. The hook's requirements exclude `Scope`.

- The slot is never read, so it does not make the instance depend on anything.
- A mount provides `MountScope`; string and stream renders do not, so `useEffect` is a no-op there.
- A throw, a failed Effect or a throwing cleanup is reported through `MountError`, which the mount sets from its `onError`. An interruption is not reported.
- Cleanup is fire-and-forget: `dispose` does not await it.
- The analyzer applies `ConditionalSlot` to it, as to `useLocal`.

## Consequences

- Timing: see ADR 0028 (originally `fn` ran during the run).
- If a run runs `fn` and then fails, the effect has still run; the next successful run compares against its `deps`.
- A first run that is dropped runs the cleanup through the disposed slots.
- Unlike React, `deps` are compared on each run of the instance, which happens when an atom it reads changes, not on every parent render.
- `RenderScope` stays internal; there is no every-run cleanup beyond `useEffect` without deps.
