## Goal & Context
<!-- scope: business -->

A host component in `@sleekstack/ui` runs once: no state, no re-render, no events (ADR 0015). Today the only state is inside a `fromReact` guest, and nothing a guest does can change what the host renders. A task board cannot filter its columns, show or hide a detail panel, or re-fetch after a vote.

Add the smallest reactive primitive that fixes this: a `<Reactive>` boundary in the host that re-runs its subtree when a native atom (`@sleekstack/core`) changes, replacing only that subtree's DOM. State stays outside components (atoms), components stay functions of props and Layers, and requirements and errors stay checked by `sleekstack check`.

Related: fn-18 (resumable spike) adds handlers, `bind` text nodes and `resume`, where components never re-run on the client. This spec is the other mode: `mount` with client-side re-rendering. The two do not share a runtime path; `Reactive` is rejected under `resume` (R8).

## Architecture & Data Models
<!-- scope: technical -->

- **`Reactive` node.** A new `Node` variant `{ _tag: 'Reactive', atom, render, context }`, built by `<Reactive atom={a}>{(value) => <jsx/>}</Reactive>` (JSX form; `reactive(atom, render)` is the plain form). `render: (value: A) => Effect<Node, E, R>`. `context` is the Effect `Context` captured when the `Reactive` component itself runs, so every enclosing `Provider` layer is still in scope on a re-run.
- **Store per mount.** `mount` creates one `AtomStore` (from `@sleekstack/core`), or uses `opts.store` when given, and provides it to the tree as the `Store` Tag (`Effect.Tag('Store')` over `AtomStore`). A component writes state with `const store = yield* Store` and hands `store.set` (or a closure) to a guest as props. `mount` disposes a store it created.
- **DOM.** A `Reactive` renders into `<sleek-reactive style="display: contents">`. On a change the renderer runs `render(value)` with the captured context, builds the new subtree, then swaps the host's children in one `replaceChildren`. Guest roots created inside the old subtree are unmounted first; their React state is lost (documented).
- **Scheduling.** One subscription per `Reactive`, made after the first commit. A change interrupts any in-flight render of that `Reactive` (Effect fiber interrupt), so the latest value wins; changes within one store batch notify once. An unmounted or superseded mount (generation token) ignores late completions.
- **Failure.** A re-run that fails or dies keeps the old DOM, reports through the mount's `onError` (as a `Cause`), and stays subscribed so the next change retries. No enclosing `Catch` / `Boundary` applies on a re-run (it is not in the tree being unwound), so the Analyzer requires the render function's errors to be handled inside it.
- **String renderer.** `renderToString` renders `Reactive` once with the atom's current value from a fresh store and emits the `<sleek-reactive>` wrapper without subscribing.
- **Analyzer.** A `reactive` node. Its `render` return is read like a component body (JSX, `Effect.gen`, `.map`). Requirements are checked against the Tags provided at the `Reactive` (the captured context). Errors are checked as if the render were its own root: an uncaught tagged error in the render result is `UnhandledError` even when an enclosing `Boundary` exists. A render passed as a non-literal function is `Unresolved` (fail closed).
- **Packages touched:** `@sleekstack/ui` (node, jsx-runtime, DOM and string renderers, `Store`; new dependency on `@sleekstack/core`), `@sleekstack/analyze` (component pass), `apps/ui-demo` (filter and detail toggle), docs and ADR.

## API Contracts
<!-- scope: technical -->

```ts
// @sleekstack/ui
interface ReactiveNode { readonly _tag: 'Reactive'; readonly atom: Atom<any>; readonly render: (value: any) => Effect<Node, any, any>; readonly context: Context<any> }
reactive<A, E, R>(atom: Atom<A>, render: (value: A) => Effect<Node, E, R>): Effect<Node, never, R>   // E is NOT in the result: a re-run cannot be caught by the tree
class Store extends Effect.Tag('Store')<Store, AtomStore>() {}
mount(app, opts: { layer; container; onError?; store?: AtomStore }): Promise<Mounted>

// JSX
<Reactive atom={Atom<A>}>{(value: A) => JSX.Element}</Reactive>
```

- `reactive`'s `E` is deliberately dropped from the result type: the render's errors never reach an enclosing `Catch`. The render function must therefore have `E = never` at the type level, or the `reactive` call does not compile; JSX cannot express this, so the Analyzer enforces it there (`UnhandledError`).
- `R` is part of the result and joins the enclosing requirements as for any component.
- `<sleek-reactive>` is a renderer-written element name; a user `el('sleek-reactive')` is rejected like `data-sleek-*` names in fn-18.

## Edge Cases & Constraints
<!-- scope: technical -->

- Nested `Reactive`: an outer change disposes inner subscriptions with the old subtree and recreates them; an inner change touches only the inner host.
- A render that reads the same atom it subscribes to is fine; a render that writes it is not guarded (loop is the author's; documented).
- An atom that never changes costs one subscription and no re-render.
- `dispose` / a superseding `mount` interrupts in-flight renders, unsubscribes every `Reactive` and unmounts guests.
- Result atoms: the render receives the `Result` value as is; matching on it is the author's concern.
- Hydration and resumability are out of scope: server HTML is replaced by `mount`, as today (ADR 0015).
- The `Reactive` render function must be synchronous to start (no work before returning the Effect) so the Analyzer can read it.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `<Reactive atom>` renders its subtree with the atom's current value on `mount` and `renderToString`. Errors: a render failure on the first render rejects `mount` / `renderToString` with the original failure, as any component does.
- **R2:** An atom change re-runs only that `Reactive`'s render and replaces only its subtree; siblings and ancestors are untouched (same DOM nodes). Errors: none beyond R5.
- **R3:** A re-run sees the `Provider` layers enclosing the `Reactive` (captured context); a Tag provided only below it is not visible. Errors: a missing Tag at re-run is a defect reported through `onError` (the Analyzer prevents it, R7).
- **R4:** Rapid changes keep the latest value: a slower earlier render never overwrites a later one; in-flight renders are interrupted. Errors: none beyond R5.
- **R5:** A re-run that fails or dies keeps the previous DOM, calls `onError` with the cause, and the next change retries. Errors: a throwing `onError` is logged and never replaces the outcome (as in fn-15).
- **R6:** `Store` gives components the mount's `AtomStore`; a guest given `store.set` as a prop updates a `Reactive` on click. `mount` disposes a store it created and never one passed in `opts.store`. Errors: reading `Store` without a `mount` store is impossible (always provided).
- **R7:** `sleekstack check` reads the render of every `Reactive`: requirements against the provided Tags, uncaught tagged errors as `UnhandledError` even under an enclosing `Boundary`, an unreadable render as `Unresolved`. Errors: no new error code.
- **R8:** `Reactive` is not allowed in a tree under `resume` (fn-18): the Analyzer reports it. Errors: reported as `Unresolved` with a message naming `resume` (no new code), and only once fn-18 has landed.
- **R9:** `dispose` and a superseding `mount` unsubscribe every `Reactive`, interrupt in-flight renders and unmount guests; late completions write nothing. Errors: no error surface beyond R5.
- **R10:** `apps/ui-demo` gains a status filter and a detail toggle driven by atoms, with a jsdom test that clicks a guest and asserts the swapped subtree. Errors: none.
- **R11:** ADR 0015 amendment (or ADR 0016, if numbering allows) records the reactive mode, the dropped `E`, the lost guest state and the `resume` exclusion; ui README documents `Reactive` and `Store`. Errors: none.

## Boundaries
<!-- scope: business -->

- No events in host elements (`on*` stays rejected); fn-18's `on` / handlers are the host event path.
- No fine-grained text binding or keyed list diffing: a change replaces the whole `Reactive` subtree.
- No SSR hydration or atom snapshot transport (fn-17 owns atom serialization).
- No preserving React guest state across a re-run.
- No per-component Scopes or lifecycle hooks.
- No devtools integration.

## Decision Context
<!-- scope: both -->

- **Atoms over a new state primitive**: native atoms already exist, have `subscribe`, and are what fn-17 and fn-18 build on. A second mechanism would split the model.
- **Replace the subtree, not diff**: matches the current "re-mount the whole tree" renderer, keeps the renderer tiny, and matches the spike scope. Diffing is a later spec if measured to matter.
- **Capture `Context` at the node**: the only way a re-run keeps `Provider` scoping without re-walking the tree; cheaper than re-rendering from the root.
- **Drop `E` from `reactive`'s type**: a re-run is not inside any `Catch`, so typing the error as catchable would lie. Forcing `E = never` makes the author handle it inside the render.
- **Rejected: React-style hooks in host components**: needs an identity per call site and a re-render loop, the dialect ADR 0015 option A rejected.
- **Rejected: waiting for fn-18**: that spike removes client component execution; this needs it. They are alternative modes, so neither blocks the other.
