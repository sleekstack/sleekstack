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

A throwing guest renders as nothing; its cause goes to `onError` or `console.error`.
