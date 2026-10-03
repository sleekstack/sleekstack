## Goal & Context
<!-- scope: business -->

A host component in `@sleekstack/ui` runs once: no state, no re-render, no events (ADR 0015). The only state today lives inside a `fromReact` guest, and nothing a guest does can change what the host renders. A task board cannot filter its columns, show or hide a detail panel, or re-fetch after a vote.

Make host components reactive the way `useState` makes React components reactive, with no wrapper to write: a component reads state through a hook (`yield* useAtomValue(atom)`), and the renderer re-runs that component and replaces its DOM when the atom changes. State stays in native atoms (`@sleekstack/core`), components stay functions of props and Layers, and requirements and errors stay checked by `sleekstack check`.

Related: fn-18 (resumable spike) adds handlers, `bind` text nodes and `resume`, where components never re-run on the client. This spec is the other mode: `mount` with client-side re-rendering. The two do not share a runtime path; a reactive component under `resume` is out of scope (R8).

## Architecture & Data Models
<!-- scope: technical -->

- **Hooks, automatic tracking.** `useAtomValue(atom)`, `useSetAtom(writable)` and `useAtom(writable)` (a `[value, set]` pair, like `useState`) are Effects, used with `yield*` inside a component. Reading an atom registers it as a dependency of the component instance that is running, with no boundary and no declaration. Dependencies are re-collected on every run, so a conditional read is fine and there are no ordering rules. `useSetAtom` registers nothing (writing never re-renders the writer). They need the mount's store, so their requirement is the `Store` Tag; `mount` provides it and the Analyzer treats it as always provided.
- **Instance wrapper.** The JSX runtime wraps every function-component call (`jsx(type, props)`): it runs the component under a per-instance collector and captures the Effect `Context` at that point (enclosing `Provider` layers, the `Store`, the boundary handlers). A component that read no atom returns its plain `Node`, so non-reactive components cost nothing and render exactly as today. A component that read atoms returns a `Reactive` node `{ atoms, child, rerun }`: `child` is what it just rendered, `rerun` re-runs the component with the captured context.
- **Store per mount.** `mount` creates one `AtomStore` (from `@sleekstack/core`), or uses `opts.store`, and provides it as the `Store` Tag (`Effect.Tag('Store')` over `AtomStore`). A component writes state with `const set = yield* useSetAtom(a)` and hands `set` to a `fromReact` guest as a prop; host elements still have no events.
- **DOM.** A `Reactive` node renders into `<sleek-reactive style="display: contents">`. After the first commit the renderer subscribes to each atom of the node. On a change it runs `rerun`, builds the new subtree, and swaps the host's children in one `replaceChildren`. The result is itself a node: if it is a `Reactive` again, the subscription set is replaced with the new `atoms`. Guest roots created inside the old subtree are unmounted first; their React state is lost (documented). A parent re-running recreates its children as fresh instances.
- **Scheduling.** Changes within one store batch notify once. A change interrupts any in-flight `rerun` of that instance (Effect fiber interrupt), so the latest value wins. A superseded or disposed mount (generation token) ignores late completions.
- **Failure and boundaries.** `Boundary` also pushes its `{ tag, fallback }` onto a handler stack in the Context (a `Context.Reference`, default empty, so it adds no requirement). When a `rerun` fails with a tagged error, the renderer applies the innermost captured handler whose tag matches and renders its fallback in place of that component's subtree. This keeps the Analyzer rule unchanged: an enclosing `Boundary` handles a component's errors on re-run as it does on the first render. An error with no matching handler, or a defect, keeps the old DOM, reports through the mount's `onError` as a `Cause`, and stays subscribed so the next change retries.
- **String renderer.** `renderToString` serializes a `Reactive` node's `child` once (no wrapper element, no subscription), from a fresh store it provides as `Store`.
- **Analyzer.** `Store` is added to the set of Tags provided at every `mount` root; no new node kind. A component that uses a hook and needs another unprovided Tag still reports `MissingDependency`; an unhandled error still reports `UnhandledError`.
- **Packages touched:** `@sleekstack/ui` (node, jsx-runtime wrapper and hooks, `Store`, DOM and string renderers, new dependency on `@sleekstack/core`), `@sleekstack/analyze` (`Store` always provided), `apps/ui-demo`, docs and ADR.

## API Contracts
<!-- scope: technical -->

```ts
// @sleekstack/ui
interface ReactiveNode { readonly _tag: 'Reactive'; readonly atoms: ReadonlyArray<Atom<any>>; readonly child: Node; readonly rerun: Effect<Node> }
class Store extends Effect.Tag('Store')<Store, AtomStore>() {}
useAtomValue<A>(atom: Atom<A>): Effect<A, never, Store>
useSetAtom<R, W>(atom: Writable<R, W>): Effect<(value: W) => void, never, Store>
useAtom<R, W>(atom: Writable<R, W>): Effect<readonly [R, (value: W) => void], never, Store>
mount(app, opts: { layer; container; onError?; store?: AtomStore }): Promise<Mounted>
```

- Outside a wrapped instance (a component called directly, not through JSX) the hooks still return the value, untracked: nothing re-renders.
- `<sleek-reactive>` is a renderer-written element name; a user `el('sleek-reactive')` is rejected like `data-sleek-*` names in fn-18.
- A result atom's value is passed as is (`Result`); matching on it is the author's concern.

## Edge Cases & Constraints
<!-- scope: technical -->

- Nested reactive components: an outer change disposes the inner subscriptions with the old subtree and recreates them; an inner change touches only the inner host.
- A component that writes an atom it reads can loop; this is the author's responsibility, as in React effects (documented).
- A component whose atoms never change costs one subscription and no re-render.
- `dispose` / a superseding `mount` interrupts in-flight reruns, unsubscribes every instance and unmounts guests.
- Hydration and resumability are out of scope: server HTML is replaced by `mount`, as today (ADR 0015).
- Module-level `Atom.make(x)` is shared by every component that reads it within one store: state is store-scoped, not per component instance.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A component that reads an atom with `useAtomValue` / `useAtom` renders with the current value on `mount` and `renderToString`, with no wrapper element in its JSX. Errors: a failure on the first render rejects with the original failure, as any component does.
- **R2:** An atom change re-runs only the components that read that atom and replaces only their subtrees; siblings and ancestors keep the same DOM nodes. Errors: none beyond R5.
- **R3:** A re-run sees the `Provider` layers enclosing the component (captured context); a Tag provided only below it is not visible. Errors: a missing Tag at re-run is a defect reported through `onError` (the Analyzer prevents it, R7).
- **R4:** Rapid changes keep the latest value: a slower earlier re-run never overwrites a later one; in-flight re-runs are interrupted. Errors: none beyond R5.
- **R5:** A re-run that fails with a tagged error handled by an enclosing `Boundary` renders that boundary's fallback in place of the component's subtree; an unhandled error or a defect keeps the previous DOM, calls `onError` with the cause, and the next change retries. Errors: a throwing `onError` is logged and never replaces the outcome (as in fn-15).
- **R6:** `Store` gives components the mount's `AtomStore`; a guest given the `useSetAtom` setter as a prop updates the reading component on click. `mount` disposes a store it created and never one passed in `opts.store`. Errors: hooks called outside a `mount` or `renderToString` fail with a `MissingDependency`-style tagged error naming `Store` rather than throwing.
- **R7:** `sleekstack check` treats `Store` as provided at every `mount`, so a component using the hooks is clean; any other missing Tag or uncaught tagged error in it is still reported. Errors: no new error code.
- **R8:** A reactive component under `resume` (fn-18) is reported by the Analyzer. Errors: reported as `Unresolved` naming `resume` (no new code); only once fn-18 has landed.
- **R9:** `dispose` and a superseding `mount` unsubscribe every instance, interrupt in-flight re-runs and unmount guests; late completions write nothing. Errors: no error surface beyond R5.
- **R10:** `apps/ui-demo` gains a status filter and a detail toggle driven by atoms and plain hooks (no wrapper), with a jsdom test that clicks a guest and asserts only the reading components' subtrees swapped. Errors: none.
- **R11:** ADR 0015 amendment (or a new ADR if numbering allows) records the automatic mode, the context capture, the boundary handler stack, the lost guest state and the `resume` exclusion; ui README documents the hooks and `Store`. Errors: none.

## Boundaries
<!-- scope: business -->

- No per-instance local state (`useState` that lives and dies with one component instance): atoms are store-scoped. Local state is a follow-up that needs an instance slot kept across re-runs.
- No events in host elements (`on*` stays rejected); fn-18's `on` / handlers are the host event path.
- No fine-grained text binding or keyed list diffing: a change re-renders the whole reading component.
- No SSR hydration or atom snapshot transport (fn-17 owns atom serialization).
- No preserving React guest state across a re-run.
- No devtools integration.

## Decision Context
<!-- scope: both -->

- **Automatic tracking, no `<Reactive>` boundary** (user decision): a hook that registers a dependency on the running instance matches `useState` ergonomics and removes a concept. The cost is that every function component goes through a small wrapper; components with no atom reads return a plain node and are unchanged.
- **Atoms over a new state primitive**: native atoms already exist, have `subscribe`, and are what fn-17 and fn-18 build on.
- **Re-render the component, not diff**: matches the current whole-subtree renderer and the spike scope. Diffing is a later spec if measured to matter.
- **Capture `Context` at the instance**: the only way a re-run keeps `Provider` scoping without re-walking the tree from the root.
- **Boundary handler stack in the Context**: a re-run is not inside any `Catch` frame, so the enclosing `Boundary` must be reachable from the captured context. Keeping that rule means the Analyzer needs no special error root for reactive components.
- **Rejected: React-style hook slots (ordered `useState`)**: needs call-order rules and an instance identity kept by the renderer, the dialect ADR 0015 option A rejected. Dependency collection by atom identity needs neither.
- **Rejected: explicit `<Reactive atom>` boundary** (first draft of this spec): works, but adds a wrapper and a render-prop for what a hook can express.
- **Rejected: waiting for fn-18**: that spike removes client component execution; this needs it. They are alternative modes, so neither blocks the other.
