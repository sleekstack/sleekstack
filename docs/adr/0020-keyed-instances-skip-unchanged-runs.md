# 0020. A keyed instance whose props and context are unchanged is not re-run

## Status

Accepted. Amends ADR 0015 (keyed instances, reconciliation).

## Context

A list built with `.map` inside a component that reads an atom re-runs every row on each write. `render-dom/keyed-update-data-1-of-1k` (1,000 keyed `Row` components taking an `item` object; one item object is replaced per write; no fresh closures) measures, in jsdom and in the same process as React (read relative to React only):

| | SleekStack | React |
|---|---:|---:|
| mean per update | 11.13ms | 2.94ms |
| row components run per update | 1,000 | 1,000 |
| node swaps per update | 0 | 0 |

Ratio 3.8. Where the time goes, per update (instrumented, the older closure-label list): run (Effects that rebuild the rows) 8.5–9.9ms, plan 2.1–2.5ms, commit 1.8ms, against 1.8, 0.75 and 0.6ms for a plain keyed `<li>` list. The reconciler is not the problem; the cost is 1,000 component runs. `instance()` costs about 5.7µs per row with no scope and no `jsx` (isolated).

Tried and rejected on measurement: batching scope closes, a `place` fast path, one context copy, a no-atom `adopt` path, direct single-child patching, and running each component with `runSyncExit` (slower, a fiber per row). Only a lazy run scope paid (13.6 → 11.9ms, commit `d43871e`).

A prototype of the shape below (the parent reuses the previous node of an unchanged row and the reconciler skips a matched `Reactive` whose node is the same object) ran at about 1.2ms per update, of which about 1.1ms is the benchmark's `setTimeout(0)` wait. It was a hand-built cache, not this implementation.

A first draft proposed a `<For each by>` primitive. A symposium (three models, two rounds) asked for the same win with no new syntax, and the panel agreed that plain `.map(item => <Row key={item.id} item={item} />)` can have it under the conditions below.

## Considered options

- **A. `<For>` primitive.** Rejected: a new public API and a new `CONTEXT.md` term for something the runtime can decide.
- **B. A compile-time transform proving rows pure.** Rejected: the Analyzer only reads trees and reports; it does not emit code, and the data benchmark needs no purity proof.
- **C. Cheaper `instance()`.** Rejected: every attempt was within noise or slower; the floor stays at 1,000 runs.
- **D. Prop-compare bailout inside `instance()`** (chosen).
- **E. Function-prop trampolines for every function prop.** Not built: a function forwarded to a child or called from a deferred render breaks a "called during the run" classification silently. Narrowed and built as a later amendment for `on[A-Z]` props only, see Decision, Handlers.

## Decision

`instance(type, props, key)` for a keyed call, after assigning its id and adding it to the parent frame's `seen` set and before it builds the run scope, reads the entry kept for that id on the parent's slot record. It reuses the entry's `Reactive` node and runs nothing when all of these hold:

1. **Props.** Every prop other than `key` is `Object.is`-equal to the entry's. A new function, a new object or a new `children` is a miss.
2. **Context.** The Effect context is service-for-service equal to the entry's, ignoring `Collector`, `Frame` and `RenderScope`. Those three are rebuilt on every parent run (`reactive.ts`, `inner`), so comparing the context object itself would always miss. Layer-built services and `Handlers` are context entries, so a rebuilt `Provider` or `Boundary` changes them and misses.
3. **Scope reusable.** The entry's run scope is either unused (`lazyScope` never forked) or *lent*: forked from the `MountScope` instead of the parent run scope, so the parent's swap does not close it. A scope that was forked from the parent run scope (a `Provider` built in it, a `useQuery` finalizer, a fallback) is not reusable and misses.
4. **No pending work of its own.** The instance has no in-flight or queued re-run, and the atoms its last run read are unchanged.

A miss runs `instance()` as today and stores the new entry. The entry is published only when the parent run commits.

`patchChildren` in `dom.ts` skips `adopt` for a matched `Reactive` whose node is the same object as the live one; key validation and placement (reorder) still run. A skipped id is already in `seen`, so `commitSlots` keeps its `useLocal` slots. A key that leaves the list is not seen: its instance is removed, its slots disposed and its entry dropped through the existing path.

**Handlers (amendment).** The first run of a keyed instance replaces each `on[A-Z]` function prop with a stable wrapper kept on the slot record; every parent run points the wrapper at the newest closure, so a fresh inline `onPick={() => pick(item.id, tab)}` does not change the props and a click, even on a skipped row, calls the newest closure. A wrapper called while its row's run is in flight (including nested child runs) marks the row: it is not remembered, because its output may depend on the handler. Only function-valued props named `on` + capital on keyed components are wrapped; `defineHandler` values are objects and are untouched; other function props still miss by identity.

**Scope lending (amendment).** A keyed run's scope, and any run's scope the first time it reads an atom (`useAtomValue` calls `lend` before retaining), is lent to the `MountScope`. The renderer already closes run scopes explicitly (replace, remove, dispose), and a failed run closes its own and drops the scopes its children lent. A rerun the renderer starts for a changed atom bypasses the memo (it would return the stale node and re-queue forever). The same rule covers unkeyed components that read atoms: they return their last node when props and services are equal, so an outer atom change no longer re-runs an inner component that reads its own atoms.

**Host-only rows (amendment).** `jsx` tags the Effect of a host element with its type and props. On a memo miss a keyed instance calls its component once; if the result is such a tag, the run read no atom and used no scope, and the node is built synchronously from the props (primitive attributes and text only; a function, atom, Effect or `on*` prop, or non-primitive child, falls back to the normal run with the Effect already built). When the output props are `Object.is`-equal to the last ones the previous node is reused, so a fresh render callback (`label={() => ...}`) is called but the row is not rebuilt. The equality is on the output, not on the callback. A row that called a wrapped handler while rendering is not remembered. The node carries no scope or frame; the parent's commit disposes its slots.

Not affected: `renderToString` (no previous run, every row renders), `resume` (never runs components, ADR 0017).

## Consequences

- **Behavior change for every keyed list.** A row is not re-run when its props are `Object.is`-equal, so an item mutated in place is no longer seen. A change is a new object or a new primitive. A test locks it: in-place mutation does not refresh the row. There is no opt-out flag and no dev-mode sampler; both were considered and left out.
- **Inline `on*` handlers no longer defeat the skip** (amendment above). Other inline function props (`format={() => ...}`) still miss; a function a row calls while rendering must be a prop whose identity is compared. Measured: `keyed-update-handler-1-of-1k` 12.0ms and 1,000 runs before the wrapper, about 1.2ms and 1 run after (React about 3.5ms).
- **Render-time function props always re-run the row.** `render-dom/keyed-update-render-callback-1-of-1k` (renamed from `keyed-update-1-of-1k`) passes a fresh `label` function that each row calls while rendering; every row correctly misses, because the row's output depends on what the function returns. Host-only rows (amendment above) now skip the rebuild: about 1.3ms against 10.6ms before (React about 3.3ms); rows that return nested components or events still miss. The same holds for any list whose rows take a formatter or render prop; rows that take data plus `on*` handlers are the fast path.
- **Rows that read atoms skip too** (scope lent). `keyed-update-atom-1-of-1k`: 1 run and about 1.2ms instead of 1,000 runs and about 18ms (React about 3.0ms). Rows that build a `Provider` or call `useQuery` still miss (their scope forks the parent run scope).
- **Behavior change for unkeyed components.** An unkeyed component that reads atoms is no longer re-run by its parent when its props and services are equal; it re-runs when an atom it read changes.
- One extra pass over the children per update (id, props compare). Reorder still goes through `place` (no LIS, ADR 0015).
- **Measured with the implementation** (jsdom, same process as React, three runs): `keyed-update-data-1-of-1k` went from 11.13ms to 1.1–1.2ms, 1 row component run per update instead of 1,000, about 0.35 of React's mean (React about 3.2ms). The closure-label benchmark (every row misses) went from about 11.0ms to about 11.25ms: the miss path costs about 2% more (props and service compare, one memo object per row). `keyed-reorder-1k` rose to IMPROVED in the compare gate (its rows keep one module-level `label`).
- The estimate (about 1.2ms) rested on a hand-built prototype; the implementation reproduced it. Revisit if real lists commonly pass inline handlers: those rows never skip (see option E).

## Open decisions

- Whether `Provider`/`Boundary` also bump a generation that rows compare, besides the service compare. One seat of three wanted it; the service compare should already catch a rebuilt `Provider`. Decide with a Provider-rebuild test.
- Leasing `Provider`/`useQuery` scopes so those rows can skip.
