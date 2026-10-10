# 0035. `Boundary` is an instance with `reset`; `Portal` renders elsewhere in its owner's context

## Status

Accepted

## Context

A `Boundary` that rendered its fallback stayed there until a parent re-ran. React apps retry a failed subtree (error boundary reset), and a failed `lazy` import is not cached, so a retry can succeed. `Boundary` was called directly by `jsx`, so it had no state to re-run on.

## Decision

`Boundary` runs as a component instance, like `Pending`. It keeps a local epoch; its fallback is `(error, reset)`. `reset()` bumps the epoch, which re-runs only the boundary's subtree, and returns `Effect.void`, so it works as `onClick={reset}` and as `yield* reset()`. Each run's `reset` fires once, and is dead once that run's scope closes (a newer run, or disposal). A failed attempt's run scopes close with the failure. A `Pending` whose failed content was raised forks again on the next run with the same props instead of replaying the failure.

### Portal

`<Portal container={el}>` renders its children into a `<sleek-portal style="display: contents">` host appended to `el` on commit, while they keep the `Provider` layers, `Store` and error handling of the portal's position. The host goes with the portal or its owner; a remount appends again, so it lands at the end of the container. A missing or detached container fails with `PortalContainerMissing`. Server rendering emits nothing for a portal, so its handlers are client-only and `hydrateMount` builds it fresh. The analyzer treats it like a fragment: its children's `E` and `R` belong to the enclosing tree.

## Consequences

- Server markup changes: a `Boundary` reads its epoch atom, so it renders inside an instance host (`<sleek-reactive style="display: contents">`), like any component that reads an atom. Hydration and streaming match it; the stream fixture expecting the bare fallback was updated.
- The fallback's signature widens from `(error)` to `(error, reset)`; existing one-argument fallbacks keep working.

## Rejected

A `resetKey` prop. Out of scope for the first slice; `reset` covers the retry case.
