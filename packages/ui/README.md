# @sleekstack/ui

Effect-native component framework (MVP). The Effect program is the host; plain React components run inside it as guests.

| Export | Purpose |
| --- | --- |
| `Component<P, E, R>` | `(props: P) => Effect<Node, E, R>` |
| `el`, `fragment` | Build `Node` trees (text, element, fragment, guest) |
| `Provide(layer, children)` | Provide a Layer to a subtree |
| `Catch(tag, fallback, children)` | Render `fallback` for one tagged error; removes only that tag from `E` |
| `fromReact(Cmp)` | Wrap a React component as a guest leaf (`Component<P, never, never>`) |
| `renderToString(app, { layer, onError })` | String renderer; rejects with the original failure or defect |
| `mount(app, { layer, container, onError })` | DOM renderer; resolves to `Mounted` once the tree and every guest root are committed. A later `mount` on the same container wins |
| `Mounted` | `{ dispose(): Promise<void> }`; empties the container and unmounts this mount's guest roots (a no-op once superseded) |

JSX: put `/** @jsxImportSource @sleekstack/ui */` at the top of a host file and every JSX expression is an `Effect<Node>`. Host components are functions of props returning JSX (or `Effect.gen` that ends in `return yield* (<jsx/>)`); `<Provider layer>` and `<Boundary tag fallback>` are the JSX forms of `Provide` and `Catch`. tsc cannot type a JSX expression's `E` / `R`, so `sleekstack check` reads them from the tree. Keep React guests in files without the pragma. Event handlers belong in guests: host attributes stay strings.

A throwing guest renders as nothing; its cause goes to `onError` or `console.error`.

In the DOM, each guest renders inside a `<sleek-guest style="display: contents">` element (the string renderer emits no wrapper). Both renderers reject `on*`, `srcdoc` and `javascript:` attributes.

`sleekstack check` runs the component pass when a project's package.json lists `@sleekstack/ui` (see [`@sleekstack/analyze`](../analyze/README.md)). A runnable demo with one fixture per error code is in [`apps/ui-demo`](../../apps/ui-demo). Design: ADR 0015.
