# SleekStack Playground

A small `@sleekstack/ui` app built with `sleekstack()` from `@sleekstack/ui-vite`: ui JSX by `include`, the analyzer,
file-based routes under `ui/src/routes`, `entries` and `prerender`. The server entry renders each page through
`handle` from `@sleekstack/router` (to a string, so the page's `<Head>` tags land in the head); the client entry
hydrates it with `startRouter`.

`ui/src/app.tsx` is `router({ table, pages, notFound })` from `virtual:sleekstack/routes`, with no page written by
hand. The route files show each convention: a root `_layout.tsx`, a `(docs)` group with its own layout, a splat
(`guide/[...slug]`), an optional param (`posts/[[page]]`), a `[id]` page with a `prerender` export, a `_counter.tsx`
helper that is not a route, and `_notFound.tsx`. In the client build each page is its own chunk.

```bash
pnpm install                                  # pnpm 11 (pinned in packageManager)
pnpm --filter sleekstack-playground dev       # vite ui, served with SSR
pnpm --filter sleekstack-playground test      # builds, serves the prerendered pages statically, hydrates one, checks dev
```

`vite build ui` writes `ui/dist/client` (with each prerendered path at `<path>/index.html`) and `ui/dist/server`.
