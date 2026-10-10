# @sleekstack/ui

Effect-native component framework (MVP). The Effect program is the host; plain React components run inside it as guests.

| Export | Purpose |
| --- | --- |
| `Component<P, E, R>` | `(props: P) => Effect<Node, E, R>` |
| `el`, `fragment` | Build `Node` trees (text, element, fragment, guest) |
| `Provide(layer, children)` | Provide a Layer to a subtree |
| `Catch(tag, fallback, children)` | Render `fallback` for one tagged error; removes only that tag from `E` |
| `fromReact(Cmp)` | Wrap a React component as a guest leaf (`Component<P, never, never>`) |
| `useAtomValue(atom)` | Read an atom and re-render this component when it changes (`Effect<A, never, Store>`) |
| `useSetAtom(atom)` | A setter `(value) => void` for a writable atom; hand it to a guest as a prop |
| `useAtom(atom)` | `[value, set]`; reads like `useAtomValue` |
| `<Pending fallback>` | Shows `fallback` while its children wait on an async Effect; a re-run keeps the previous content until the new one resolves |
| `lazy(() => import('./X'))`, `LazyLoadError` | A component whose module loads on first render, under `Pending`; the bundler splits it into its own chunk. The module loads once; a failed import (or no default export component) fails with `LazyLoadError` for a `Boundary` and is retried on the next render |
| `useSuspenseQuery(options)` (`@sleekstack/query/ui`) | Waits on a query under `Pending`: `Effect<T, QueryFailed, QueryClientTag \| Store>`; re-runs on result change, returns held data without refetching |
| `useLocal(initial)` | `[value, set]` local state in an ordered slot of this instance; kept across re-runs, released when the instance is removed. Call it only at the top of the component body (`ConditionalSlot`) |
| `useEffect(fn, deps?)` | As in React: `fn` runs after the DOM of the first run is committed, and again when `deps` change (every run without `deps`, once for `[]`); its returned cleanup runs before the next `fn` and when the instance is removed or the mount disposed (not awaited). `fn` may be an Effect itself, or return one (run with the context in its own `Scope`, interrupted as the cleanup). `fn` may be a generator function: it follows the atoms it reads (`yield* useAtomValue(a)`, also after an await) instead of `deps`, and when one changes its scope closes (finalizers are the cleanup) and it runs again; the component's own runs don't restart it (it re-runs from its latest closure), `deps` restart it too, and props are not tracked, so list them in `deps`. A throw or failure goes to `onError`. A dropped run never runs its effects. Not run by `renderToString` / `renderToStream`. Takes a slot like `useLocal`, so call it only at the top of the component body (`ConditionalSlot`) |
| `useRef(initial?)` | A `{ current }` box, the same object across runs. Pass it as a host element's `ref` prop: `current` is the element once it is attached (before the commit's effects) and `null` after it is removed. Type it with the element: `useRef<HTMLInputElement>()` fits only `<input ref>` (`Ref` is invariant). Same slot rule as `useLocal` |
| `useDerivedAtom(source)` | A derived atom owned by the instance: the same atom on every run, recomputed when an atom it reads with `get` changes. `source` is an Effect, `(get) => Effect`, a generator function `function* (get) { … }`, or `(get) => value`; Effects run in the component's context (its services, the `Layer`s above it) and the atom holds a `Result`. The services join the component's requirements. Context of the first run, newest closure on recompute; `get` is tracked before the first async step. Same slot rule as `useLocal` |
| `key` prop | Identity among siblings for elements and components; a keyed component keeps its instance and state when moved. Lists rendered with `.map` need one (`MissingKey`) |
| `onXxx={(event) => effect}` | Event closure on a host element, typed from the element's event map: `onClick` gets a `MouseEvent` whose `currentTarget` is the element; multi-word events are camel-cased (`onPointerDown`). The value is a function, a generator, an Effect, or a `defineHandler` (bubbling events only); a string is a type error. Runs in the DOM with the context captured at the element; `E` must be `never`, failures go to `onError`. Not run by `renderToString` or `resume`; attached by `hydrateMount` |
| `<form action={fn}>` | A form action (ADR 0033): a function, a generator, an Effect or a `defineHandler`. On submit it runs with an `ActionEvent` whose `formData` is the form's data plus the submitter's name and value (built at dispatch, never sent by the server). Setting it prevents the browser's submit; `onSubmit` runs first; a second submit interrupts the running one; the form is not reset. A Promise result is a `TypeError` (use a generator or an Effect). A string `action` stays a URL |
| `DuplicateKey`, `SlotMismatch` | Runtime errors: two siblings share a key; a re-run used a different number of `useLocal` slots |
| `Store` | Tag over core's `AtomStore`; provided by `mount` and `renderToString` |
| `renderToString(app, { layer, onError })` | String renderer; rejects with the original failure or defect. Provides a fresh `Store`, renders reactive components once and appends the `data-sleek-hydrate` state script |
| `renderToStream(app, { layer, nonce, idPrefix, onError })` | Streaming renderer (`ReadableStream<Uint8Array>`): the shell flushes with `Pending` fallbacks, each boundary's content follows as a chunk swapped in place. See Streaming SSR |
| `mount(app, { layer, container, onError, store? })` | DOM renderer; provides `store` (or a new one it disposes) as `Store`; resolves to `Mounted` once the tree and every guest root are committed. A later `mount` on the same container wins |
| `hydrateMount(app, { layer, container, onError, store? })` | Runs the app once against `renderToString` HTML and adopts the server DOM; seeds atoms and the query cache from the `data-sleek-hydrate` script (no refetch needs `staleTime > 0`). Falls back to a full `mount` on a renderer defect |
| `HydrateConflict`, `HydrationMismatch`, `HydratePayloadInvalid` | Hydrate errors: container already mounted or hydrated; a server node did not match (replaced, reported to `onError`); a malformed state script (client initial values used). A missing script is not an error |
| `BoundaryChunkMissing` | A streamed boundary's chunk never arrived (the stream ended without it); its fallback stays, reported to `onError` |
| `Mounted` | `{ dispose(): Promise<void> }`; empties the container and unmounts this mount's guest roots (a no-op once superseded) |

JSX: put `/** @jsxImportSource @sleekstack/ui */` at the top of a host file and every JSX expression is an `Effect<Node>`. Host components are functions of props returning JSX (or `Effect.gen` that ends in `return yield* (<jsx/>)`); `<Provider layer>` and `<Boundary tag fallback>` are the JSX forms of `Provide` and `Catch`. tsc cannot type a JSX expression's `E` / `R`, so `sleekstack check` reads them from the tree. Keep React guests in files without the pragma. Host elements are typed per tag (ADR 0031): an unknown attribute or a wrong value type is a tsc error. Values are primitives, `null`/`undefined` (attribute removed) or an atom of those. `class` is canonical and `className` is accepted, but not both (same for `for` / `htmlFor`); `aria-*` and `data-*` work on every tag; custom elements (hyphenated tags) take any props. `on*` props are event closures and `ref` takes a `Ref` of that element.

State: a host component that reads an atom with `useAtomValue` / `useAtom` re-runs when it changes (inside `<sleek-reactive style="display: contents">`), and the result is reconciled against the live DOM: elements patch in place, child instances keep their ids, local state and subscriptions, and focus and input values survive. The re-run keeps its captured `Provider` layers and `Boundary` handlers; an uncaught re-run error keeps the old DOM and goes to `onError`. A guest matched across a re-run (same React component, same key or position) keeps its React root and state and receives the new props; it unmounts when removed or when its component or key changes. A hook with no `Store` fails with `MissingDependency` naming `Store`.

Async: `<Pending fallback>` shows `fallback` until its content resolves, then keeps that content on later re-runs until the new run resolves (latest run wins; unmount interrupts). `useSuspenseQuery` fails with the tagged `QueryFailed { cause }`. A content error renders the matching `Boundary` fallback (replacing old content); with no match it goes to `onError` and the old content or fallback stays. A nested instance that re-runs on its own never shows the fallback. `renderToString` awaits Pending content with no fallback and no timeout. The fallback must not suspend.

Code splitting: `const Chart = lazy(() => import('./Chart'))`, then `<Pending fallback={<p>Loading</p>}><Chart data={data} /></Pending>`. `Chart.tsx` default-exports a host component. `renderToString` awaits the import; `hydrateMount` adopts the server nodes.

A throwing guest renders as nothing; its cause goes to `onError` or `console.error`.

In the DOM, each guest renders inside a `<sleek-guest style="display: contents">` element (the string renderer emits no wrapper). Both renderers reject string `on*`, `srcdoc` and `javascript:` attributes.

Limits: ordinal identity is positional, so conditional siblings of one component shift each other's state (use `key`); an instance that turns from reactive to plain on a parent re-run is replaced; keyed moves have no LIS, so a swap moves the rows between; a guest boundary stays in its fallback after a throw.

`sleekstack check` runs the component pass when a project's package.json lists `@sleekstack/ui` (see [`@sleekstack/analyze`](../analyze/README.md)). A runnable demo with one fixture per error code is in [`apps/ui-demo`](../../apps/ui-demo). Design: ADR 0015.

## Streaming SSR

`renderToStream` returns the shell first: the tree with each waiting `Pending` as `<!--sleek-p:ID-->fallback<!--/sleek-p-->`, plus one inline runtime script and the `data-sleek-hydrate` payload (with a `b` map from boundary id to path). Each resolved boundary follows as `<template data-sleek-b="ID">…</template><script>__sleekSwap("ID")</script>`, which replaces the placeholder. Boundaries that never resolve are listed in a final `__sleekEnd([ids])`; `hydrateMount` reports each as `BoundaryChunkMissing` and keeps the fallback. `hydrateMount` can run before the stream ends: it adopts each chunk as it lands. A tree with nothing pending streams exactly the `renderToString` output.

Pass `nonce` for a strict CSP; every inline script carries it. Ids are `<idPrefix><n>` (default `sleek-`). The runtime is page-global and a later shell replaces it, so give each stream on one page a distinct `idPrefix`, and hydrate at most one. A streamed page hydrates; it does not `resume`. Protocol: ADR 0023.

## Installing

`effect` is a peer dependency of `@sleekstack/ui`, `@sleekstack/core` and `@sleekstack/query`. Install exactly one copy of `effect` in the app; two copies (for example a nested `effect` under one package) are unsupported, since Context tags and Effect values from different copies do not match. The built output targets bundlers (Vite, esbuild); importing it from Node-native ESM is unsupported. The package stays `private: true` until the publish gate in ADR 0022 holds; that ADR also records the size budget (`mount` hello-world about 193 kB gzip, React DOM included).
