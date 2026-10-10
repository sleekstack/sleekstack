# 0037. `@sleekstack/ui` devtools: an optional render observer of plain-data events

## Status

Accepted

## Context

A developer debugging a ui app could not see which instances are mounted, why one re-ran, which atoms it owns or when its effects ran. Atoms were inspectable through the store snapshot; the rest of the renderer was internal. Chart fn-41 picked four views (D1) and the renderer as the hook point (D2).

## Decision

`mount` and `hydrateMount` take an optional `observe: RenderObserver`. The renderer calls it with `RenderEvent`s: `create`, `adopt` (instances adopted by hydration), `rerun` with every coalesced reason (atom labels, or `parent`), `dispose`, `slot`, and `effect` (`start`, `restart`, `cleanup` by slot index). Each event carries the mount id and a page-unique instance id.

- Events are plain data: ids and values, never a reference to a live instance, so a disposed instance is not retained by an observer.
- `useEffect` reports through an `EffectObserver` context reference that defaults to `undefined` and is provided only by an observed mount.
- With no observer, the renderer builds no event objects; the bench scenarios and the ADR 0022 size budget are unchanged.
- The observer never changes rendering results or ordering.
- `@sleekstack/devtools` holds the views (`uiTrace()`, `<UiPanel>`) and has `@sleekstack/ui` as a peer dependency; ui never depends on devtools.

## Consequences

- Each mount is labeled by its id, and atom values come from the store its observer was given, so several mounts on a page stay apart.
- The ui-demo app opens the panel behind `import.meta.env.DEV`; production builds drop it.
- `resume` takes no observer and reports nothing: it calls no component and adopts no instances, only bound text and handlers (R11's "resume" case is empty by construction).

## Rejected

- Exposing live instances to the observer: an observer could keep a disposed instance alive.
- Hooks inside ui that import devtools: ui would pay for devtools in every bundle.
- Time travel, editing atom values from the panel, a browser extension and production telemetry: out of scope.
