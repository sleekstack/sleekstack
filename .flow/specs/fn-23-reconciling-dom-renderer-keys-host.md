## Goal & Context
<!-- scope: business -->

`@sleekstack/ui` re-renders a reactive host component by re-running it and replacing its whole DOM subtree with `replaceChildren` (fn-19, ADR 0015 amendment). That throws away everything the browser holds on those nodes: input focus and typed text, scroll position, running animations, and every React guest root inside (their state is lost, documented as a caveat in the README). Host elements also cannot handle events (`on*` attributes are rejected; handlers live only in guests), so a host-only app cannot react to a click.

This is the first spec of the plan to take `@sleekstack/ui` toward a production framework (decided in a design interview, 2026-10-03). It makes the DOM renderer **reconcile**: the new `Node` tree from a re-run is diffed against the tree already on screen and only the difference is patched. On that base it adds the three things the interview put in the renderer core: `key` for lists, host event closures, and instance-local state (`useLocal`). Components still re-run on an atom change; there is no fine-grained reactivity (rejected in the interview).

The audience is the maintainer's own apps. `apps/ui-demo` is the proving ground; nothing outside this repo depends on the current swap behavior, so it is changed in place.

Later specs (not this one): `Pending` async boundaries, hydration, streaming SSR, a published build, the router adapter and the Vite plugin. The reconciler is designed so hydration can adopt server DOM through it (see Architecture), but adopting is not built here.

## Architecture & Data Models
<!-- scope: technical -->

Base: `origin/master` after fn-18 (`packages/ui/src/{node,dom,reactive,jsx-runtime,component,handler,resume}.ts`).

- **Live tree.** The DOM renderer keeps, per mount, a `Live` tree: for each rendered `Node`, the DOM node(s) it produced plus what is needed to patch it (kind, tag, last attrs, key, event closures, child `Live`s, the guest `Root`, the instance record for a `Reactive`). It replaces today's flat `Owner { roots, kids, scopes }`. A `Live` is built from a `Node` and the DOM it created, never from the DOM alone, so a later spec can build one around server DOM (hydration).
- **Two-phase patch.** A re-run's result is applied in two phases so the existing guarantee holds (a renderer defect or a superseded run keeps the old DOM untouched):
  1. *Plan*: diff `Live` against the new `Node`, create every new DOM node and guest root aside, validate every tag and attribute (`checkTag`, `checkAttr`). It may fail or be abandoned; it does not touch the live DOM or mutate `Live`.
  2. *Apply*: only operations that cannot fail on validated input (`setAttribute`/`removeAttribute`, property sets, `insertBefore`, `remove`, `nodeValue`, `root.render` on an existing guest root) and `Live` updates. Then close the replaced run scopes.
- **Matching rules** (children of one parent, `Fragment`s flattened into the parent's list first, so `<>a b</>` and `a b` are equal):
  1. A child with a `key` matches the sibling with the same `String(key)`.
  2. A `Reactive` (component instance) child matches by instance id (below).
  3. Any other child matches the next unkeyed, unmatched sibling by position and kind: same `Element` tag patches in place; a different tag, or a different kind, replaces. `Text` updates `nodeValue` when changed. `Guest` matches when the React component is the same function.
  4. Unmatched old children are removed (guest roots unmounted, instances killed); unmatched new children are created. Keyed matches that changed order are moved with `insertBefore`; the reconciler does not compute a minimal move set beyond keeping already-ordered runs in place.
- **Instance identity.** The identity of a component instance is assigned **when the component runs**, not by the renderer, because `useLocal` reads the instance's state during that run, before any diff. `instance()` (`reactive.ts`) reads a parent frame from a new `Context.Reference` (the same pattern as `Collector` and `RenderScope`) and builds the child id as `<function id>` + `#<ordinal>` or `<function id>` + `:key:<String(key)>`, where the function id is a per-function number from a `WeakMap` and the ordinal counts **every** call of that function in the parent run, whether or not the child reads atoms (a count that skipped non-reactive calls would shift when a child later starts reading one, so identity allocation cannot be lazy). A child run gets its own frame, so its children's ids are computed inside it. A self re-run (`rerun`) reuses the instance's id and its own frame and never touches the parent's counters. A component whose run read no atoms and called no `useLocal` and has no `key` still returns its plain node unchanged; it still hands its children the frame it received.
- **Keyed components are always instances.** A function component with a `key` always returns a `Reactive` node (empty atom list when it read none, so no subscriptions) so the key has a DOM host to match and move: the `sleek-reactive` element. Cost: one extra wrapper element per keyed component only; unkeyed non-reactive components stay free.
- **Match precedence.** A key matches only a sibling of the same kind and type (same tag, same component function id, same guest component) with the same `String(key)`; otherwise the old child is removed and the new one created. Instances match by id, which already encodes function and key or ordinal, so a keyed instance and an ordinal instance never collide. Ordinal identity follows position: `{cond && <A/>}<A/>` shifts the second `A`'s ordinal and hands it the first one's state, the same behavior as positional matching in React; `key` is the fix and the README says so.
- **Reactive and plain transitions.** An instance that returns a plain node on a parent-initiated re-run (it stopped reading atoms) has no id to match, so its old subtree is replaced. Its own re-run keeps the host and only drops subscriptions (today's behavior). Both are documented limits.
- **Matched instance.** A re-run of a parent produces a fresh `Reactive` node for each child component (the child body already ran). When it matches a live instance, the instance **adopts** the new node: new `rerun`, new atom list, new run scope; its subscriptions are re-established for the new atom list and its previous run scope closes after the commit. Its subtree is patched against the new node's `child`. Epoch, coalescing and latest-wins interruption (fn-19) are unchanged. Adopting also interrupts the matched instance's own in-flight re-run fiber, bumps its epoch (a change queued under the old subscription set is dropped) and re-checks `seen` against the current atom values after resubscribing.
- **Guests.** A matched guest keeps its React root and host element; the new props are rendered into the existing root (`root.render(...)` inside `flushSync`, as the first render does). The `GuestBoundary` and error routing are unchanged. A guest is unmounted only when it is removed, its component changes or its key changes. The README caveat "guests inside the re-run subtree are remounted and lose their React state" is removed.
- **Events.** `Node` gains an optional element field `events` (event name to `EventBinding`; the field name `on` stays reserved for fn-18's `Handler` map, which `mount` still ignores). `EventBinding` is `{ run: (event: Event) => Effect<void, never, any>, context: Context.Context<any> }`. In `jsx-runtime`, a function-valued `onXxx` prop on a host element becomes an `events` entry whose `context` is `Effect.context()` captured while that element's JSX Effect runs, so the closure sees the enclosing `Provider` layers and `Store` even when the element sits in a non-reactive component or in a `Provider` below the nearest instance, and needs no owning instance. The event name is the remainder lowercased (`onClick` -> `click`); a non-function `on*` prop is still rejected by `checkAttr`. The renderer adds one direct `addEventListener` per element per event name (not delegated, so non-bubbling events work; `handler.ts`'s `checkEvent` does not apply) that calls the *current* binding stored on the `Live`; a patch swaps the stored binding and never re-listens; a removed event removes its listener. A run is `Effect.runFork` of `run(event)` provided with `context`, so a synchronous Effect (an `Effect.sync` that calls `event.preventDefault()`) runs before the listener returns. The fiber is tracked on the element's `Live` and interrupted when the element is removed, its instance is killed, or the mount is disposed. A synchronous throw from the closure, a non-Effect return, a failure or a defect goes to `onError`. Events are ignored by `renderToString`.
- **`key`.** `key` (already dropped from attributes by `jsx-runtime`) is carried on `Node` as an optional string on elements, `Reactive` and `Guest` nodes (a keyed component becomes a `Reactive`, above). Optional fields are omitted when absent, never set to `undefined`, so existing `toEqual` assertions on plain nodes hold. `renderToString` ignores `key`.
- **`useLocal`.** `useLocal(initial)` called in a component's body returns `Effect<readonly [A, (next: A | ((previous: A) => A)) => void], never, Store>`, backed by a writable atom held in the instance's slot list: slot *n* is the *n*-th `useLocal` call of that run; slots persist across re-runs and are disposed with the instance. Reading it registers the atom with the run's `Collector`, so the component re-runs on `set`. A run that calls a different number of `useLocal`s than the previous run fails with the tagged error `SlotMismatch` (a runtime backstop for the static rule). In `renderToString`, `useLocal` returns `initial` and a no-op setter. Slots live in the parent frame's registry keyed by instance id, created at run time. A slot created by a run is *pending* until that run's result is committed in the apply phase; a run that is dropped (superseded, failed, plan aborted) disposes the slots it created and leaves earlier ones alone. After a commit, slots of ids the committed tree no longer holds are disposed with their instances. `SlotMismatch` fails the run like any other failure: the old DOM stays, the cause goes to `onError`, and the slot cursor is not committed.

## API Contracts
<!-- scope: technical -->

```ts
// node.ts
interface ElementNode {
  readonly _tag: 'Element'
  readonly tag: string
  readonly attrs: Readonly<Record<string, string>>
  readonly children: ReadonlyArray<Node>
  readonly on?: Readonly<Record<string, Handler<any, any>>>            // fn-18, unchanged
  readonly events?: Readonly<Record<string, EventBinding>>
  readonly key?: string
}
interface EventBinding {
  readonly run: (event: Event) => Effect.Effect<void, never, any>
  readonly context: Context.Context<any>
}
// GuestNode and ReactiveNode gain `readonly key?: string`; ReactiveNode also gains `readonly id: string` (@internal).

// @sleekstack/ui
useLocal<A>(initial: A): Effect.Effect<readonly [A, (next: A | ((previous: A) => A)) => void], never, Store>
```

```tsx
/** @jsxImportSource @sleekstack/ui */
const List = () => <ul>{items.map((i) => <Row key={i.id} item={i} />)}</ul>
const Button = () => <button onClick={(e) => Effect.sync(() => console.log(e.type))}>go</button>
const Counter = () =>
  Effect.gen(function* () {
    const [n, setN] = yield* useLocal(0)
    return yield* (<button onClick={() => Effect.sync(() => setN((x) => x + 1))}>{n}</button>)
  })
```

- New tagged errors, registered in the existing error table and docs: `DuplicateKey` (two siblings with one key; reported through `onError`, the later one is treated as unkeyed), `SlotMismatch` (above).
- New Analyzer codes (component pass, `@sleekstack/analyze`):
  - `ConditionalSlot`: `useLocal` is not called at the top level of a component body (inside a condition, loop, nested function, or after an early `return`; inside `Effect.gen`, only before the first conditional `return`). Anything the Analyzer cannot prove is an error (fails closed).
  - `MissingKey`: a `.map` callback in a child position returns JSX (an element or a component) with no `key` prop.
  - Event closures: the closure's `R` is checked against the tree like a child component's `R` (`MissingDependency`); its `E` must be `never` (otherwise `UnhandledError`; handle it in the closure with `Effect.catchTag`).
- `mount` and `renderToString` signatures do not change.

## Edge Cases & Constraints
<!-- scope: technical -->

- **Form controls.** `value` and `checked` on `input`/`textarea`/`select` are set as DOM properties when they differ from the current property value, so a patch never overwrites text the user typed unless the new `Node` carries a different value. Other attributes use `setAttribute`/`removeAttribute`; an attribute absent from the new `Node` is removed.
- **Focus and selection.** A patch that keeps an element does not move it (`insertBefore` is skipped when it is already in place), so `document.activeElement`, selection and scroll are preserved.
- **Mixed keyed and unkeyed siblings** are allowed; keys are compared as `String(key)` (`1` and `'1'` collide, which is reported as `DuplicateKey`).
- **Superseded and failed runs.** A re-run that is interrupted, fails, or whose plan phase fails leaves `Live` and the DOM exactly as before and closes any scope it opened (the fn-19 guarantees). A matched instance adopts a new node only in the apply phase.
- **Guests created in the plan phase** are mounted into a detached host, so their React effects run; a dropped plan unmounts them (`release`) and the test asserts no effect leaks. `root.render` on a matched guest runs inside `flushSync` from the renderer's microtask, never from a React render or effect; React defects reach `onUncaughtError` (already routed to `onError`), so the apply phase does not throw. `GuestBoundary` keeps its current behavior: once a guest has thrown it renders nothing until it unmounts; new props do not reset it.
- **`DuplicateKey`** is detected in the plan phase, reported once per patch (and once at first mount) through `onError`, never rejects `mount`, and the later duplicate is treated as unkeyed. Mixed keyed and unkeyed siblings use separate pools: unkeyed children consume the unkeyed old children left to right and never claim a keyed one.
- **Form controls, more.** `<select>` value is assigned after its options are inserted; `<input>` `type` before `value`; a radio group's `checked` is set as a property per input.
- **Focus on moves.** A keyed move that must `insertBefore` a node holding focus saves and restores `document.activeElement` and selection when focus was lost.
- **Instance removal** runs the full kill sequence (interrupt the run fiber, unsubscribe, unmount guests, kill child instances, close run scopes, dispose local atoms) for every removed subtree.
- **Event closure lifetime.** A closure that is running when its element is removed or its instance is killed is interrupted with the instance's fibers. A closure never runs after `mount`'s `Mounted.dispose()` resolves.
- **Fragments** keep no DOM of their own; `Live` records their flattened children so a patch can move them. SVG namespace handling is unchanged (not supported, as today).
- **Performance.** The `jsx-overhead` benchmark (fn-22) must stay within its tolerance. Identity allocation is a counter bump and a `Map` lookup per component call in the parent frame; there is no lazy fallback (see Instance identity). If the gate trips, reduce the allocation first (one `Map` per frame, no per-call closures); the baseline is refreshed deliberately only with the measured cost recorded in the ADR amendment.
- **Backward compatibility.** Existing `mount`/`renderToString` outputs, `sleek-reactive` and `sleek-guest` wrapper elements, the Analyzer error codes and the resume path (fn-18) are unchanged. The only behavior change is that DOM nodes and guest roots persist across re-runs.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A re-run patches the DOM instead of replacing it: when only a text node or an attribute changes, the same DOM nodes remain in the document; a focused `<input>` keeps `document.activeElement` and its typed `value` when an unrelated sibling changes; a different tag replaces the element. Errors: a renderer defect while planning (a rejected tag or attribute) leaves the previous DOM untouched and goes to `onError`.
- **R2:** The patch is two-phase: the plan phase creates DOM aside and never mutates the live DOM or `Live`; a test makes the plan phase fail partway and asserts the live DOM is byte-identical and no guest root or scope leaked. Errors: a run superseded during the plan phase is dropped with its scopes closed.
- **R3:** Keyed children (elements, guests and function components, including components that read no atoms, which become keyed `Reactive` instances) reconcile by `String(key)` and kind/type: reordering moves existing DOM nodes (node identity preserved for every kept key), insertion and removal create/remove only the difference, and unkeyed siblings match by position. A duplicate key reports `DuplicateKey` once per render and treats the later sibling as unkeyed. Errors: none beyond `DuplicateKey`.
- **R4:** A React guest keeps its React state when its parent host component re-runs, when it is matched by position or key and is the same component; its new props reach the existing root. It unmounts (and its React state is dropped) when removed, when its component changes or when its key changes. The README caveat about lost guest state is removed. Errors: a throwing guest keeps rendering nothing and reports through `onError`, as today.
- **R5:** A nested reactive component instance survives its parent's re-run when matched: no double re-run, no leaked subscription, latest-wins interruption still holds, the previous run scope closes after the commit and a removed instance is fully killed (fibers interrupted, subscriptions released, scopes closed). Errors: the existing fn-19 tests (`reactive.test.ts`, `reactive-dom.test.ts`) pass unchanged except where they assert the old guest remount behavior. The fn-21 `useQuery`/`useMutation` observer registry keeps its retain count across an adopt (retained by the new run before the old run scope closes) and releases it on kill; a test covers both. A matched instance with an in-flight re-run adopts the parent's new node without a double run.
- **R6:** A host element accepts function-valued `onXxx` props: the closure runs on the event inside the instance's captured `Context` (a `Provider` layer above the element is visible, including one between the component and the element and a host element inside a component that reads no atoms), one direct listener per element and event name, the closure swapped without re-listening on a patch and the listener removed when the prop is removed or the element goes. A failure or defect goes to `onError`. A non-function `on*` prop is still rejected. Errors: a closure still running after `dispose()` resolved is a test failure.
- **R7:** `useLocal(initial)` keeps its value across re-runs of the same instance, re-runs the component on `set` (value and updater forms), is independent per instance (two siblings, or the same component under two keys), resets when the instance's key changes or it is removed and re-added, and is disposed with the instance. `renderToString` returns `initial` with a no-op setter. Errors: a run with a different number of `useLocal` calls fails with `SlotMismatch`.
- **R8:** The Analyzer reports `ConditionalSlot`, `MissingKey` and event-closure `MissingDependency` / `UnhandledError` with file:line, fail-closed, and they appear in `sleekstack check --json` `components`. Errors: an unreadable closure type is reported, not skipped.
- **R9:** `apps/ui-demo` uses all three features in at least one real screen (a keyed list that reorders without losing an input's focus, a host `onClick`, a `useLocal` toggle) and its jsdom test passes. Errors: none. The three `.map`s in `components.tsx` that would trip `MissingKey` get keys, and the `fn-21` query-driven list with a guest mutation keeps working.
- **R10:** The fn-22 benchmark suites still run: `jsx-overhead` stays within tolerance, the reactive-update case keeps reporting node-swap count (nodes added or removed, now expected to be near zero; the JSON key and docs column are unchanged), and a keyed-list reorder case and a one-of-1000 update case are added with a final-state correctness check; the new cases are `NEW` until `baseline.json` is refreshed deliberately in the same PR. Errors: a regression above tolerance fails the `bench` job.
- **R11:** Docs: an amendment to ADR 0015 (reconcile instead of swap, host events, `useLocal` ordered slots reversing the earlier rejection now that instances have identity), `@sleekstack/ui` README, CONTEXT.md terms (Reconciler, Live tree, Key, Local state), the error table (`DuplicateKey`, `SlotMismatch`, `ConditionalSlot`, `MissingKey`) and the docs coverage test pass. Errors: none.

## Quick commands
<!-- scope: technical -->

```bash
pnpm --filter @sleekstack/ui test && pnpm --filter @sleekstack/ui typecheck
pnpm --filter @sleekstack/analyze test
pnpm --filter ui-demo test
pnpm --filter bench bench:json && pnpm --filter bench compare
```

## Early proof point

Task fn-23-reconciling-dom-renderer-keys-host.2 validates the core approach (component identity assigned at run time is cheap enough for the `jsx-overhead` gate and stable under self re-runs). If it fails, re-evaluate the identity design (for example moving identity to the renderer and giving up read-time `useLocal`) before continuing with fn-23-reconciling-dom-renderer-keys-host.3 and later tasks.

## Boundaries
<!-- scope: business -->

- No fine-grained reactivity, signals or atom-bound text/attributes; components re-run on change.
- No `Pending` / async boundaries, hydration, streaming SSR, router adapter, Vite plugin or published build (separate specs).
- No change to the resume path (`defineHandler`, `on`, `bind`, `resume`); it stays frozen and `mount` still ignores `Node.on`. Host event closures are dead under `renderToString` and under `resume`; no Analyzer warning for that in this spec.
- No synthetic event system, event delegation, event pooling, portals or refs.
- No routing of event-closure errors to a `Boundary` (see Decision Context); closure `E` must be `never`.
- No controlled-input abstraction beyond the `value`/`checked` property rule.
- No minimal-move algorithm (LIS) for keyed reorders.

## Decision Context
<!-- scope: both -->

- **Reconcile, not fine-grained** (2026-10-03 interview): the maintainer first chose fine-grained (Solid-style) and then reverted to re-render. Re-run granularity keeps "a component is a function of its props and Layers" and fn-19's captured-context and handler-stack design; the reconciler removes the worst symptom (lost DOM state) at a fraction of the cost of a second reactive model.
- **Identity assigned at run time**: `useLocal` is read during the child's run, before any diff, so the renderer cannot be the one that assigns identity. Cost: the `jsx-overhead` benchmark is the guard.
- **Ordered slots (`useLocal`) over named slots**: the maintainer chose ordered `useState`-style slots for an instance-local state API, reversing ADR 0015's rejection (made when instances had no identity). Safety comes from the Analyzer rule `ConditionalSlot` plus the runtime backstop `SlotMismatch`; a rejected alternative was `useLocal('name', init)` (no order rule, but explicit names on every call).
- **Event closures, direct listeners**: closures read `E`/`R` like any component and match what JSX users expect; direct listeners (not delegation) so non-bubbling events work. `defineHandler` stays for resume only.
- **Event closure `E` must be `never`** (a narrowing of "errors flow to Boundary or onError" from the interview): a `Boundary` is a render-time construct with no state to trip from outside a run, so routing a late event failure into a fallback needs its own design. Until then the closure must handle its own typed errors and defects go to `onError`. Revisit when `Pending` (the next spec) settles how boundaries re-enter a committed tree.
- **Fragments flattened for matching**: simplest rule that keeps `<>` free of DOM; accepted cost: unkeyed siblings that shift position across a fragment boundary are matched by position.
- **Keyed components become instances**: a component that reads no atoms returns a bare node with nowhere to hold a key; forcing a `Reactive` host for keyed components only gives the key a DOM node to match and move, at the cost of one wrapper element in lists. Rejected a key-stamped fragment as overkill: it needs range moves.
- **Identity ordinal counts every call, no lazy allocation**: skipping non-reactive calls would shift ordinals when a child later starts reading an atom, silently moving state between instances. Cost is a counter bump per component call, guarded by `jsx-overhead`.
- **Event context captured at the element**: the closure needs the `Provider` layers visible where the element is written, not where the nearest instance runs, and non-reactive components have no instance. Rejected looking up an owning instance at dispatch time.
- **`GuestBoundary` stays sticky** and the swap-count benchmark column keeps its name: both were considered and left alone to keep this spec to the reconciler.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | A re-run patches the DOM instead of replacing it: when only a text node or an attribute changes, the same DOM nodes remain in the document; a focused `<input>` keeps `document.activeElement` and its typed `value` when an unrelated sibling changes; a different tag replaces the element. Errors: a renderer defect while planning (a rejected tag or attribute) leaves the previous DOM untouched and goes to `onError`. | fn-23-reconciling-dom-renderer-keys-host.4 | — |
| R2 | The patch is two-phase: the plan phase creates DOM aside and never mutates the live DOM or `Live`; a test makes the plan phase fail partway and asserts the live DOM is byte-identical and no guest root or scope leaked. Errors: a run superseded during the plan phase is dropped with its scopes closed. | fn-23-reconciling-dom-renderer-keys-host.4 | — |
| R3 | Keyed children (elements, guests and function components, including components that read no atoms, which become keyed `Reactive` instances) reconcile by `String(key)` and kind/type: reordering moves existing DOM nodes (node identity preserved for every kept key), insertion and removal create/remove only the difference, and unkeyed siblings match by position. A duplicate key reports `DuplicateKey` once per render and treats the later sibling as unkeyed. Errors: none beyond `DuplicateKey`. | fn-23-reconciling-dom-renderer-keys-host.2, fn-23-reconciling-dom-renderer-keys-host.4 | — |
| R4 | A React guest keeps its React state when its parent host component re-runs, when it is matched by position or key and is the same component; its new props reach the existing root. It unmounts (and its React state is dropped) when removed, when its component changes or when its key changes. The README caveat about lost guest state is removed. Errors: a throwing guest keeps rendering nothing and reports through `onError`, as today. | fn-23-reconciling-dom-renderer-keys-host.6 | — |
| R5 | A nested reactive component instance survives its parent's re-run when matched: no double re-run, no leaked subscription, latest-wins interruption still holds, the previous run scope closes after the commit and a removed instance is fully killed (fibers interrupted, subscriptions released, scopes closed). Errors: the existing fn-19 tests (`reactive.test.ts`, `reactive-dom.test.ts`) pass unchanged except where they assert the old guest remount behavior. The fn-21 `useQuery`/`useMutation` observer registry keeps its retain count across an adopt (retained by the new run before the old run scope closes) and releases it on kill; a test covers both. A matched instance with an in-flight re-run adopts the parent's new node without a double run. | fn-23-reconciling-dom-renderer-keys-host.5 | — |
| R6 | A host element accepts function-valued `onXxx` props: the closure runs on the event inside the instance's captured `Context` (a `Provider` layer above the element is visible, including one between the component and the element and a host element inside a component that reads no atoms), one direct listener per element and event name, the closure swapped without re-listening on a patch and the listener removed when the prop is removed or the element goes. A failure or defect goes to `onError`. A non-function `on*` prop is still rejected. Errors: a closure still running after `dispose()` resolved is a test failure. | fn-23-reconciling-dom-renderer-keys-host.7 | — |
| R7 | `useLocal(initial)` keeps its value across re-runs of the same instance, re-runs the component on `set` (value and updater forms), is independent per instance (two siblings, or the same component under two keys), resets when the instance's key changes or it is removed and re-added, and is disposed with the instance. `renderToString` returns `initial` with a no-op setter. Errors: a run with a different number of `useLocal` calls fails with `SlotMismatch`. | fn-23-reconciling-dom-renderer-keys-host.3 | — |
| R8 | The Analyzer reports `ConditionalSlot`, `MissingKey` and event-closure `MissingDependency` / `UnhandledError` with file:line, fail-closed, and they appear in `sleekstack check --json` `components`. Errors: an unreadable closure type is reported, not skipped. | fn-23-reconciling-dom-renderer-keys-host.8, fn-23-reconciling-dom-renderer-keys-host.9 | — |
| R9 | `apps/ui-demo` uses all three features in at least one real screen (a keyed list that reorders without losing an input's focus, a host `onClick`, a `useLocal` toggle) and its jsdom test passes. Errors: none. The three `.map`s in `components.tsx` that would trip `MissingKey` get keys, and the `fn-21` query-driven list with a guest mutation keeps working. | fn-23-reconciling-dom-renderer-keys-host.10 | — |
| R10 | The fn-22 benchmark suites still run: `jsx-overhead` stays within tolerance, the reactive-update case keeps reporting node-swap count (nodes added or removed, now expected to be near zero; the JSON key and docs column are unchanged), and a keyed-list reorder case and a one-of-1000 update case are added with a final-state correctness check; the new cases are `NEW` until `baseline.json` is refreshed deliberately in the same PR. Errors: a regression above tolerance fails the `bench` job. | fn-23-reconciling-dom-renderer-keys-host.11 | — |
| R11 | Docs: an amendment to ADR 0015 (reconcile instead of swap, host events, `useLocal` ordered slots reversing the earlier rejection now that instances have identity), `@sleekstack/ui` README, CONTEXT.md terms (Reconciler, Live tree, Key, Local state), the error table (`DuplicateKey`, `SlotMismatch`, `ConditionalSlot`, `MissingKey`) and the docs coverage test pass. Errors: none. | fn-23-reconciling-dom-renderer-keys-host.12 | — |
