# 0027. `useMount`: an effect tied to an instance

## Status

Accepted.

## Context

A component body runs again whenever an atom it reads changes, and each run's `Scope` closes when a newer run replaces it. So an effect written in the body is per run. There was no way to say "once, when this instance appears, and clean up when it goes away".

## Decision

`useMount(effect)` takes a slot in the instance (like `useLocal`) and, when the slot is new, starts `effect` as a fiber with the run's context and its own `Scope`. A release added to the instance's `Slots.releases` interrupts the fiber and closes the scope. Slots are disposed when the instance is removed, when a first run is dropped, and when the mount is disposed, and the release cascades to child instances.

- Re-runs skip it. The slot is never read, so it does not make the instance depend on anything.
- A mount provides `MountScope`; string and stream renders do not, so `useMount` is a no-op there.
- A failure is reported through `MountError`, which the mount sets from its `onError`. An interruption is not reported.
- Cleanup is fire-and-forget: `dispose` does not await it.
- The effect may require `Scope`; the hook removes it from the component's requirements.

## Consequences

- No post-commit timing: the effect starts during the first run, not after the DOM is attached.
- It must be called unconditionally (`SlotMismatch`, `ConditionalSlot`), like `useLocal`.
- A per-run effect (cleanup on every re-run) is still not exposed; `RenderScope` stays internal.
