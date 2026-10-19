# SleekStack Playground

A small `@sleekstack/ui` app built with `sleekstack()` from `@sleekstack/ui-vite`: ui JSX by `include`, the analyzer,
file-based routes under `ui/src/routes` and `entries`. The server entry streams each page through `handle` from
`@sleekstack/router` (`renderToStream`); the client entry hydrates it with `startRouter`.

```bash
pnpm install                                  # pnpm 11 (pinned in packageManager)
pnpm --filter sleekstack-playground dev       # vite ui, served with SSR
pnpm --filter sleekstack-playground test      # builds both bundles, renders and hydrates the page, checks the dev server
```

`vite build ui` writes `ui/dist/client` and `ui/dist/server`.
