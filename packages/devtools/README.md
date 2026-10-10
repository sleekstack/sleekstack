# @sleekstack/devtools

Dev-only panel for `@sleekstack/next` apps. `<SleekStackDevtools />` polls the route handler from
`@sleekstack/next/devtools` and shows every graph root with its kind, live scopes, per-service acquire/release, read-only values of the atoms of every open
`LayerProvider` store (plus any you pass it) and the last errors with the scope each ran in. It renders an empty state when the handler is off (404 or unreachable).

```tsx
// app/api/devtools/route.ts
import { devtoolsHandler } from '@sleekstack/next/devtools'
export const GET = devtoolsHandler({ graph: () => report })

// mounted only outside production, under a <LayerProvider> when `atoms` is given
<SleekStackDevtools atoms={{ demoToggles }} />
```

Mount it behind `process.env.NODE_ENV !== 'production'` with a dynamic `import()` so production
client chunks never contain it (`DEVTOOLS_MARKER` is what the showcase bundle test looks for).

## `@sleekstack/ui` mounts

`uiTrace()` records the render events of `@sleekstack/ui` mounts (`@sleekstack/ui` is a peer dependency; ui never
depends on devtools). `<UiPanel>` shows, per mount, the instance tree with keys and slots, the atoms each instance owns
with current values (from the store you pass), why instances re-ran and when their effects started, restarted or
cleaned up.

```tsx
const trace = uiTrace()
await mount(app, { layer, container, store, observe: trace.observe })
// in a React dev-only tree
<UiPanel trace={trace} store={store} />
```
