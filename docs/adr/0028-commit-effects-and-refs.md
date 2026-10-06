# 0028. Effects run after the commit; `useRef` and the `ref` prop

## Status

Accepted. Amends ADR 0027, whose effects ran during the component's run.

## Context

A component run produces a `Node` tree; the renderer builds or patches the DOM from it afterwards, in a plan and a commit. An effect run during the component's run therefore could not touch the element it rendered (focus, measure), and an effect of a run that was later dropped had already run.

## Decision

- `useEffect` queues its work on the run's `RunFrame` (`effects`). The renderer collects the frames of the instances a plan builds, adopts or re-runs (`collect`, into the plan's `Post`) and runs them with `flush` once the plan is committed: after `commit(p)` for a mount and a re-run, after the walk for `hydrateMount`, and after a streamed boundary lands. A child's effects run before its parent's. A run that is dropped or aborted discards its queue (`dropSlots`), so its effects never run; deps are compared when the queue runs, against the last committed run.
- A component that calls `useEffect` is an instance node (`sleek-reactive`) even when it reads no atom, on the server as well (the frame is marked `effectful` before the server check), so server markup and hydration agree.
- `useRef(initial?)` takes a slot (like `useLocal`) holding one `{ current }` box that never re-runs the instance. A host element's `ref` prop (an object with `current`) is not an attribute: `ElementNode.ref` carries it. The renderer sets `ref.current` to the element when the plan commits, before any effect of that commit runs, and to `null` when the element is removed (only if it still holds that element). A changed `ref` object is swapped on patch. `renderToString` ignores it.
- The analyzer applies `ConditionalSlot` to `useRef`.

## Consequences

- `useEffect(() => ref.current?.focus(), [])` works.
- An effect that sets an atom re-runs its readers through the normal microtask queue, after the commit.
- A callback `ref` and a `ref` on a component (forwarding) are not supported.
