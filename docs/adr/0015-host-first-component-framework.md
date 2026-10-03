# `@sleekstack/ui` is host-first: the Effect program is the host, React components are guests

Status: Proposed (MVP spike).

An Effect-native component is `Component<P, E, R> = (props: P) => Effect<Node, E, R>`: `R` is the Tags it needs and `E` its tagged errors, so both come from the Effect types. The host primitives are `mount` / `renderToString`, `Provide(layer, children)`, `Catch(tag, fallback, children)` and `fromReact(Cmp)`. `fromReact` returns a `Component<P, never, never>` guest leaf that React renders with its own `react-dom`; the guest gets no Effect context and its subtree is opaque. A component is never rendered inside a React component. The Analyzer builds one tree per `mount` call and reports `MissingDependency`, `UnhandledError`, `EffectInsideReact` and `Unresolved` with file:line, failing closed.

## Considered options

- **A. A dialect that compiles to real React**: rejected. It cannot give interruption or scheduling beyond React's own, and requirements and errors would have to be re-derived from JSX instead of read from the Effect types.
- **B. A React-compatible renderer**: rejected. It means tracking every React release, and it cannot work with Next.js.
- **C. Host-first with React guests** (chosen, a variant): the Effect type system stays the source of truth, so typed requirements and typed errors per component are checked at build time across files, and existing React components still render as guests.

## Consequences

- The mount layer must be fully satisfied (`RIn = never`); `Catch` over `E = never` is uncallable. An uncaught error rejects `mount` with the original tagged error, never a `FiberFailure`.
- Renderers: a string renderer (SSR and tests) and a minimal DOM renderer that re-mounts the whole tree (a later `mount` on a container wins; superseded handles are no-ops). In the DOM, each guest sits inside a `<sleek-guest style="display: contents">` element. Both renderers reject `on*`, `srcdoc` and `javascript:` attributes.
- `sleekstack check` runs the component pass only when the nearest package.json lists `@sleekstack/ui`; other projects are checked as before, and `--json` gains a `components` key only for ui projects.
- No Next.js or React Server Components: a host-first runtime cannot be aliased into React's flight protocol. No per-component Scopes, interruption, fine-grained reactivity or devtools in the MVP.
- `@sleekstack/ui` is not in the docs API reference while it is a spike.
- The ui Component is unrelated to the `component` Lifetime.

## Open decisions

- The package name (`@sleekstack/ui` is a working name; the analyzer's library matcher keys on it).
- Whether the framework sits beside kit (kit stays Effect-free) or later replaces kit's React side.
- Whether to keep the minimal DOM renderer or reuse an existing one.
- Whether to ever support Next.js.
