# `@sleekstack/ui` is host-first: the Effect program is the host, React components are guests

Status: Proposed (MVP spike).

An Effect-native component is `Component<P, E, R> = (props: P) => Effect<Node, E, R>`: `R` is the Tags it needs and `E` its tagged errors, so both come from the Effect types. The host primitives are `mount` / `renderToString`, `Provide(layer, children)`, `Catch(tag, fallback, children)` and `fromReact(Cmp)`. `fromReact` returns a `Component<P, never, never>` guest leaf that React renders with its own `react-dom`; the guest gets no Effect context and its subtree is opaque. A component is never rendered inside a React component. The Analyzer builds one tree per `mount` call and reports `MissingDependency`, `UnhandledError`, `EffectInsideReact` and `Unresolved` with file:line, failing closed.

## Considered options

- **A. A dialect that compiles to real React**: rejected. It cannot give interruption or scheduling beyond React's own, and requirements and errors would have to be re-derived from JSX instead of read from the Effect types. (Amended: a JSX *syntax* for the host is accepted, see Amendment; it still compiles to Effect nodes, not React.)
- **B. A React-compatible renderer**: rejected. It means tracking every React release, and it cannot work with Next.js.
- **C. Host-first with React guests** (chosen, a variant): the Effect type system stays the source of truth, so typed requirements and typed errors per component are checked at build time across files, and existing React components still render as guests.

## Consequences

- The mount layer must be fully satisfied (`RIn = never`); `Catch` over `E = never` is uncallable. An uncaught error rejects `mount` with the original tagged error, never a `FiberFailure`.
- Renderers: a string renderer (SSR and tests) and a DOM renderer (a later `mount` on a container wins; superseded handles are no-ops). In the DOM, each guest sits inside a `<sleek-guest style="display: contents">` element. Both renderers reject string `on*`, `srcdoc` and `javascript:` attributes. (Amended: the DOM renderer reconciles and runs host event closures, see Amendment: reconciling renderer.)
- `sleekstack check` runs the component pass only when the nearest package.json lists `@sleekstack/ui`; other projects are checked as before, and `--json` gains a `components` key only for ui projects.
- No Next.js or React Server Components: a host-first runtime cannot be aliased into React's flight protocol. No devtools in the MVP. (Amended: host components can hold state through atoms and re-render, see Amendment: reactive host subtrees.)
- `@sleekstack/ui` is not in the docs API reference while it is a spike.
- The ui Component is unrelated to the `component` Lifetime.

## Amendment: JSX syntax for the host

`@sleekstack/ui/jsx-runtime` lets a host file (opted in with `/** @jsxImportSource @sleekstack/ui */`) write the tree in JSX. Every JSX expression is an `Effect<Node>`; intrinsic tags build elements, function tags are host components, and `<Provider layer>` / `<Boundary tag fallback>` are the JSX forms of `Provide` / `Catch`. Nothing becomes React: the Effect program is still the host and React guests (files without the pragma) are still opaque leaves.

- tsc cannot type a JSX expression's `E` / `R` (`JSX.Element` is `Effect<Node, never, never>`), so the Analyzer reads them from the JSX tree and the component's own return type. `sleekstack check` is the only check for missing dependencies and uncaught errors in JSX; the `el` form keeps tsc's checking.
- The Analyzer's tree adds JSX elements and fragments (host tags are transparent), `Provider` as `provide` and `Boundary` as `catch`; a `Boundary` fallback's components are siblings, not caught children.
- Host attributes stay strings (`className` / `htmlFor` map to `class` / `for`). A function-valued `onXxx` prop is an event closure (see Amendment: reconciling renderer).

## Amendment: reactive host subtrees

A host component holds state in atoms. `useAtomValue(atom)`, `useSetAtom(atom)` and `useAtom(atom)` read and write through the `Store` Tag (an `AtomStore` from `@sleekstack/core`). `mount` creates one store per call, or uses `opts.store`, and provides it as `Store`; it disposes only a store it created. `renderToString` provides a fresh store, renders once and appends the store's state for `hydrateMount` (see Amendment: hydration).

- **Automatic mode.** There is no `<Reactive>` boundary. Every JSX function component runs through a small wrapper; if the run read atoms, it returns a `Reactive` node holding those atoms and a `rerun`. Components that read none return their plain node unchanged. (Superseded: ordered local-state slots and run-time identity are accepted, see Amendment: reconciling renderer.)
- **Re-run the component.** In the DOM a `Reactive` node renders into `<sleek-reactive style="display: contents">`. On an atom change (coalesced per tick, latest run wins) the renderer re-runs the component. (Superseded: the result is reconciled against the live DOM and child instances are kept, see Amendment: reconciling renderer.)
- **Context capture.** The wrapper captures the Effect `Context` at the instance, so a re-run keeps its `Provider` scoping without re-walking from the root. The renderer owns each run's scope: `Provider` layers stay alive while that run is current and are released when a newer run supersedes it.
- **Boundary handler stack.** A re-run is not inside any `Catch` frame, so the enclosing `Boundary` handlers are kept in the captured context and applied to the re-run. An error no handler catches keeps the current DOM and goes to `onError`. The Analyzer needs no special error root for reactive components.
- **Guest state.** (Superseded by Amendment: reconciling renderer: a matched guest keeps its React root and state.)
- **`resume` exclusion.** fn-18's `resume` mode never re-runs components on the client; the two modes share no runtime path. A reactive component under `resume` is out of scope and, once fn-18 lands, reported by the Analyzer as `Unresolved` naming `resume`.
- **Missing store.** A hook with no `Store` in context fails with the core `MissingDependency` naming `Store`. The Analyzer treats `@sleekstack/ui`'s `Store` as provided by every `mount`; a different Tag that merely prints as `Store` is not.

## Amendment: reconciling renderer

The DOM renderer reconciles instead of swapping subtrees. This supersedes "a minimal DOM renderer that re-mounts the whole tree", "event handlers stay in guests", "Re-render the component, not diff", "Lost guest state" and the rejection of ordered hook slots above.

- **Identity at run time.** `instance(type, props, key)` gives each component call an id when it first runs: a per-function id plus its ordinal among same-type unkeyed siblings in the parent's run, or plus its key. Keyed calls do not consume the unkeyed ordinal. A re-run reuses its id and never bumps its parent's counters. `mount` and `renderToString` provide a root frame. No lazy identity: ids are assigned when the run happens, not derived from the tree later.
- **Keyed components are instances.** A component called with `key` always returns a `Reactive` node (with empty atoms when it reads none), rendered in a `sleek-reactive` host, so it can be moved and adopted by id. `ReactiveNode.id` is required. `key` is typed through `JSX.IntrinsicAttributes`.
- **Reconciliation.** The renderer keeps a live tree and plans a patch, then applies it: elements and text patch in place, fragments are flattened, keyed and unkeyed children are matched from separate pools, and form-control `value` / `checked` are set as properties only when they changed. A matched `Reactive` node adopts the live instance (subscriptions, run scope and slots). A matched guest (same component and key, or same position) keeps its React root and re-renders with new props. Two siblings with one key raise `DuplicateKey` once per patch.
- **Local state.** `useLocal(initial)` keeps ordered slots per instance as writable atoms in the `Store`; they survive re-runs of the instance and its parent and are released when the instance is removed. A run whose slot count differs from the first run fails with `SlotMismatch`. `Instance` slots are per instance, so a `useMutation` observer is not recreated on adopt. The Analyzer reports `ConditionalSlot` for a `useLocal` call that is not a top-level statement of the component body before any return.
- **Event context at the element.** A function `onXxx` prop on a host element is an event closure: `events` on the element node holds `{ run, context }`, with the Effect context captured where the element is built. The DOM renderer adds one listener per element and event name and swaps the binding on patch. A closure's fiber runs with that context, is interrupted when the element or instance goes, and every failure goes to `onError`. `renderToString` and `resume` do not run closures; `resume` still uses Handlers, and `hydrateMount` attaches closures to the adopted server elements (see Amendment: hydration). Closure `E` must be `never`: the Analyzer reports `UnhandledError` for a closure error even under a matching `Boundary`, `MissingDependency` for its `R`, and `Unresolved` for a closure type it cannot read. Its closure nodes carry an optional `closure` flag.
- **Keys in lists.** The Analyzer reports `MissingKey` for an unkeyed element, component or fragment returned from a `.map` / `.flatMap` / `Array.from` callback in child position.

Known limits:

- An instance that goes from reactive to plain on a parent re-run is replaced, not adopted.
- Ordinal identity is positional: conditional siblings of one component shift each other's state. Use `key`.
- Two untracked sibling components can each hold a reactive child with the same id; those are matched in order.
- `GuestBoundary` stays in its fallback after a throw.
- Keyed moves have no LIS or `moveBefore`: a swap of two rows moves the rows between them.

Cost: assigning identity allocates on the string path too. With `baseline.json` refreshed on purpose, `render-string/list-1k` rose from 1.742 to about 2.41 against React, and `jsx-overhead` from 3.135 to 3.318 (non-reactive) and 2.647 to 3.131 (one reactive). This is accepted; skipping identity on the string path is a possible follow-up.

## Amendment: Pending boundaries

`<Pending fallback>` (from `@sleekstack/ui` and the jsx-runtime) shows `fallback` while its content waits on an async Effect, then swaps in the content. It is an instance (id, key, slots): its content runs in its own fiber, scope and frame, and the resolved node is kept in a slot. `useSuspenseQuery(options)` from `@sleekstack/ui/query` is the async read to put under it.

- **Keep previous.** A re-run of a Pending whose content suspends again keeps the previous content on screen until the new content resolves; the fallback shows only on the first run. A newer run interrupts and closes an unfinished older one (latest wins); removing the Pending interrupts its fiber, closes its scope and drops any late result.
- **Errors.** A failed content run goes through the instance's Boundary handlers. With a matching `Boundary`, its fallback renders, replacing old content on a re-run too. With no matching `Boundary`, the error goes to `onError` and the Pending fallback (first run) or the old content (re-run) stays.
- **Innermost wins.** Nested Pendings each show their own fallback for their own content. A nested instance that re-runs on its own (an atom or query change) with new suspending content never shows a fallback: its old DOM stays until the run resolves.
- **`useSuspenseQuery`.** Its type is `Effect<T, QueryFailed, QueryClientTag | Store>`: a failed fetch is the tagged `QueryFailed { cause }`. There is no runtime missing-client error; a missing `QueryClientTag` is a compile-time requirement (and a `MissingDependency` from the Analyzer). It shares the query's observer with `useQuery`, re-runs the component when the shared result changes, and returns held data without refetching. Interrupting it cancels the fetch.
- **String renderer.** `renderToString` awaits Pending content inline and never emits the fallback. There is no timeout: a content Effect that never settles keeps `renderToString` pending. A failure rejects with its typed error, unless a `Boundary` catches it.
- **Fallback must not suspend.** The fallback is rendered as-is; it is not awaited, and it is not itself under the Pending.
- **Analyzer.** It identifies Pending as `ui/pending#Pending` (the jsx-runtime re-exports it) and treats it as transparent: the content's `E` and `R` flow to the enclosing tree.

## Open decisions

- The package name (`@sleekstack/ui` is a working name; the analyzer's library matcher keys on it).
- Whether the framework sits beside kit (kit stays Effect-free) or later replaces kit's React side.
- Whether to ever support Next.js.

## Amendment: hydration

`hydrateMount(app, { layer, container, onError?, store? })` makes `renderToString` output interactive by running the app once on the client and adopting the server DOM instead of rebuilding it. Matching elements, text, `sleek-reactive` instances and guest hosts are kept; listeners, `useLocal` slots and atom subscriptions attach to them. It is the third client mode beside `mount` (builds the DOM) and `resume` (runs no component, ADR 0017).

- **Markup.** `renderToString` always wraps a `Reactive` node in `<sleek-reactive style="display: contents;">` and a guest in `<sleek-guest style="display: contents;">`, and puts `<!--sleek-t-->` between adjacent text nodes so the parser keeps them apart. A user tree cannot build either wrapper or the separator. A `sleek-bind` is unwrapped to its text on hydrate.
- **State payload.** `renderToString` appends one `<script data-sleek-hydrate>` holding core `dehydrate(store)` and the layer QueryClient's dehydrated cache; it is left out when both are empty. `hydrateMount` reads and removes it and seeds the store (also a given `opts.store`) and the QueryClient before the first run, so each component runs once. A malformed payload is reported as `HydratePayloadInvalid` and the app starts from client initial values. A missing payload falls back silently, because the server leaves it out when there is no state. A query does not refetch on hydrate only when its `staleTime` is above 0, as in React Query.
- **Errors.** `HydrateConflict` rejects `hydrateMount` on a container already mounted or hydrated, before the app runs; a later `mount` replaces a hydrated tree as usual. A node that does not match is replaced and reported once per subtree as `HydrationMismatch`; extra server nodes are removed and reported once per parent. A renderer defect during the walk disposes the adoption and falls back to a full `mount`, so on that path components run twice.
- **Guests** hydrate with React `hydrateRoot`; React's recoverable errors go to `onError` as `HydrationMismatch`.
- **Pending.** While hydrating, `Pending` awaits its content inline as the server does and shows no fallback.

Known limits:

- The first parent re-run after hydration turns a `Pending` into a reactive instance and rebuilds its DOM once (it keeps the content, not the fallback). Removing this needs a server-side host for `Pending`.
- Parser-normalised markup (an implied `tbody`) reports a mismatch and recovers by replacing the subtree.
- `adoptLateBoundary` in `pending.ts` is an internal, unexported no-op left for streamed boundaries (fn-27).
