# 0020. A keyed instance whose props and context are unchanged is not re-run

## Status

Proposed. Amends ADR 0015 (keyed instances, reconciliation).

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
- **E. Function-prop trampolines** (a stable wrapper per function prop, compared only if called during the run). Not built: a handler forwarded to a child, or called from a deferred render, breaks the "called during the run" classification silently. It can return as its own ADR if a benchmark shows inline handlers are what blocks the win.

## Decision

`instance(type, props, key)` for a keyed call, after assigning its id and adding it to the parent frame's `seen` set and before it builds the run scope, reads the entry kept for that id on the parent's slot record. It reuses the entry's `Reactive` node and runs nothing when all of these hold:

1. **Props.** Every prop other than `key` is `Object.is`-equal to the entry's. A new function, a new object or a new `children` is a miss.
2. **Context.** The Effect context is service-for-service equal to the entry's, ignoring `Collector`, `Frame` and `RenderScope`. Those three are rebuilt on every parent run (`reactive.ts`, `inner`), so comparing the context object itself would always miss. Layer-built services and `Handlers` are context entries, so a rebuilt `Provider` or `Boundary` changes them and misses.
3. **Scope idle.** The entry's run scope was never forked (`lazyScope` unused: no atom retain, no `Provider` built in it, no fallback). The reused scope is replaced by a new `lazyScope` of the current parent run's scope and the node's `rerun` is re-provided with the current context. A row whose scope forked is a child of the parent run scope that the parent's swap closes, so it misses.
4. **No pending work of its own.** The instance has no in-flight or queued re-run, and the atoms its last run read are unchanged.

A miss runs `instance()` as today and stores the new entry. The entry is published only when the parent run commits.

`patchChildren` in `dom.ts` skips `adopt` for a matched `Reactive` whose node is the same object as the live one; key validation and placement (reorder) still run. A skipped id is already in `seen`, so `commitSlots` keeps its `useLocal` slots. A key that leaves the list is not seen: its instance is removed, its slots disposed and its entry dropped through the existing path.

Not affected: unkeyed components (as today), `renderToString` (no previous run, every row renders), `resume` (never runs components, ADR 0017).

## Consequences

- **Behavior change for every keyed list.** A row is not re-run when its props are `Object.is`-equal, so an item mutated in place is no longer seen. A change is a new object or a new primitive. A test locks it: in-place mutation does not refresh the row. There is no opt-out flag and no dev-mode sampler; both were considered and left out.
- **Inline handler props defeat the skip.** `onPick={() => pick(item.id)}` is a new function each run, so a row that takes one never skips. Module-level or stable functions hit. This is the main limit on the win, and the reason trampolines (option E) may return.
- **The older benchmark does not improve.** `render-dom/keyed-update-1-of-1k` passes a fresh `label` closure that the row calls at render; every row correctly misses. It stays as the worst-case control.
- **Rows that read atoms or build a `Provider` miss** (scope forked); they keep their own atom-driven updates (`update-1-of-1k`, ratio about 0.43).
- One extra pass over the children per update (id, props compare). Reorder still goes through `place` (no LIS, ADR 0015).
- **Measured with the implementation** (jsdom, same process as React, three runs): `keyed-update-data-1-of-1k` went from 11.13ms to 1.1–1.2ms, 1 row component run per update instead of 1,000, about 0.35 of React's mean (React about 3.2ms). The closure-label benchmark (every row misses) went from about 11.0ms to about 11.25ms: the miss path costs about 2% more (props and service compare, one memo object per row). `keyed-reorder-1k` rose to IMPROVED in the compare gate (its rows keep one module-level `label`).
- The estimate (about 1.2ms) rested on a hand-built prototype; the implementation reproduced it. Revisit if real lists commonly pass inline handlers: those rows never skip (see option E).

## Open decisions

- Whether `Provider`/`Boundary` also bump a generation that rows compare, besides the service compare. One seat of three wanted it; the service compare should already catch a rebuilt `Provider`. Decide with a Provider-rebuild test.
- Whether a convention (`onXxx` function props) is excluded from the props compare, with the latest closure kept reachable. Only if the benchmark shows handlers are the blocker.
- Leasing the scope of a row that uses atoms so it can skip too.
