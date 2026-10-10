# 0034. Transitions and deferred atoms without concurrent lanes

## Status

Accepted.

## Context

A write that shows a new key or branch under `Pending` replaced the previous DOM with `fallback` until the new content resolved. React avoids that with `startTransition` and `useDeferredValue`, both built on concurrent rendering: lanes, interruptible renders and a second work-in-progress tree. The ui renderer has none of these. A re-run is scheduled on a microtask, runs to completion and commits.

## Decision

**Core primitive.** `@sleekstack/core` exports `markedWrites(f)` and `notifyMarked()`. `markedWrites` runs `f` with its writes marked, in any store. A listener notified for a change caused only by marked writes sees `notifyMarked()` true. The mark is captured per write, so an enclosing `store.batch` that delays the notification keeps it. One unmarked write in the same change clears it. Nested calls and a throwing `f` leave no mark. Core knows nothing about rendering: the mark is a flag on a notification.

**Transition.** `startTransition(write)` in `@sleekstack/ui` is `markedWrites`. An instance re-run caused only by marked writes carries the transition flag. Inside that re-run, a `Pending` with no content yet (a new key or branch) waits for its content inline instead of committing `fallback`, so the previous DOM stays on screen until the whole re-run commits. A `Pending` that already shows content behaves as before (it keeps the previous content). A captured re-run and a keyed memo ignore the flag, so ADR 0020's skips still apply.

**Limit.** A transition is a flag, not a scheduler. It does not lower the priority of the re-run, cannot be interrupted by a later urgent write, and does not split a long synchronous render. A later write re-runs the instance again and the newest run wins as before. There is no `isPending`.

**Deferred atom.** `useDeferredAtom(source)` takes a slot (like `useLocal`) holding a writable atom owned by the instance. The instance reads `source`; after each committed run it copies the run's current `source` value into the deferred atom, so readers of the deferred atom re-run after the source's commit, not with it. An unchanged value does not notify. It is released with the instance (analyzer: `ConditionalSlot`). Outside a mount (`renderToString`) it returns `source` itself, so the server HTML equals the source's.

## Consequences

- Navigation-like writes keep the previous screen without a fallback flash, with no second tree and no change to the commit path.
- An expensive view can read the deferred copy and update one commit after the cheap one.
- Neither gives React's responsiveness under a long render: that needs interruptible rendering, which this renderer does not have. A bench case (`render-dom/transition-deferred-1-of-1k`) measures a marked write followed by a deferred read.
- The ui size budget (ADR 0022) holds without a limit change.
