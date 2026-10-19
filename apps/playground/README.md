# SleekStack Playground

A small `@sleekstack/ui` app built with `sleekstack()` from `@sleekstack/ui-vite`: ui JSX by `include`, the analyzer,
file-based routes under `ui/src/routes`, `entries` and `prerender: true`. The server entry renders each page through
`handle` from `@sleekstack/router` (to a string, so the page's `<Head>` tags land in the head); the client entry
hydrates it with `startRouter`.

```bash
pnpm install                                  # pnpm 11 (pinned in packageManager)
pnpm --filter sleekstack-playground dev       # vite ui, served with SSR
pnpm --filter sleekstack-playground test      # builds, serves the prerendered pages statically, hydrates one, checks dev
```

`vite build ui` writes `ui/dist/client` (with each route prerendered to `<path>/index.html`) and `ui/dist/server`.
