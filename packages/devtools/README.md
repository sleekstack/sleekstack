# @sleekstack/devtools

Dev-only panel for `@sleekstack/next` apps. `<SleekStackDevtools />` polls the route handler from
`@sleekstack/next/devtools` and shows the dependency graph, live scopes, read-only atom values and
the last errors. It renders an empty state when the handler is off (404 or unreachable).

```tsx
// app/api/devtools/route.ts
import { devtoolsHandler } from '@sleekstack/next/devtools'
export const GET = devtoolsHandler({ graph: () => report })

// mounted only outside production, under a <LayerProvider> when `atoms` is given
<SleekStackDevtools atoms={{ demoToggles }} />
```

Mount it behind `process.env.NODE_ENV !== 'production'` with a dynamic `import()` so production
client chunks never contain it (`DEVTOOLS_MARKER` is what the showcase bundle test looks for).
