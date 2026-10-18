# @sleekstack/ui-vite

The SleekStack Vite plugin. It covers ui JSX, `sleekstack check` diagnostics, stable component ids, file-based routes for `@sleekstack/router`, and client and SSR bundles. It is a plugin, not a meta-framework.

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sleekstack } from '@sleekstack/ui-vite'

export default defineConfig({
  plugins: [
    react(), // only when the app has React guests
    sleekstack({
      include: 'src/**/*.tsx',
      entries: { client: 'src/entry-client.ts', server: 'src/entry-server.ts' },
    }),
  ],
})
```

`apps/playground/ui` is a working example: a router app streamed by `handle(..., { stream: true })` and hydrated by `startRouter`.

## Options

`sleekstack(options?)` returns an array of plugins. Every option is optional.

| Option                | Default      | What it does                                                                                                                                                                                                                                   |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `include` / `exclude` | none         | Globs (relative to the Vite root) or regexes of `.jsx` / `.tsx` files that are ui JSX without the pragma. A file that already names a `@jsxImportSource` keeps it.                                                                             |
| `routesDir`           | `src/routes` | Directory of route files, relative to the Vite root. Serves `virtual:sleekstack/routes`.                                                                                                                                                       |
| `entries`             | none         | `{ client, server }`, paths relative to the Vite root. `vite build` writes `dist/client` and `dist/server`, and the dev server answers every request through `server`. Without it, the plugin builds and serves the app as Vite normally does. |

## JSX and the pragma rule

ui JSX is opt-in per file (ADR 0015). The plugin sets no global `jsxImportSource`:

- A file with `/** @jsxImportSource @sleekstack/ui */` compiles against `@sleekstack/ui/jsx-runtime`. Put the pragma on line 1. Vite 8's Oxc transform reads it only in the comments before the first statement; after an `import` it is plain text and the file compiles as React JSX.
- A file matched by `include` (and not by `exclude`) gets the pragma added at the start of line 1.
- Any other file keeps the default, which is React JSX from `@vitejs/plugin-react` for guest files. Pragma'd ui files and React guest files can sit side by side in one app.

## Analyzer diagnostics

The plugin runs `@sleekstack/analyze` (the `sleekstack check` passes) over the Vite root's `tsconfig.json`.

- **Build:** the analyzer always runs, and an analyzer error fails the build with `file:line`.
- **Dev:** the analyzer runs after source changes, with a debounce. Errors show in Vite's error overlay with the `file:line` of the first, and the overlay clears when a run comes back clean.
- **Crashes:** a crash inside the analyzer is logged, and shown in the overlay in dev. It never throws out of the plugin or stops the dev server.

The analyzer is loaded through jiti on first use, and a run is synchronous whole-program TypeScript, so the dev server stops answering requests while a run lasts.

The analyzer reads router `pages` only as an object literal written in place. Write the pages out in the `router({ ... })` call, as the example's `app.tsx` does. Passing `pages` from `virtual:sleekstack/routes` hides them from the analyzer.

## Stable component ids

Each function that a ui JSX file exports gets the id `<path from the Vite root, no extension>#<export name>`. `fnId` in `@sleekstack/ui` uses that id instead of its load-order counter, and HMR (fn-31) depends on it.

- The id is set where the function is declared. A re-export keeps the source module's id, and so does a re-evaluation of the same module.
- Two files that would give the same id, such as `a.tsx` and `a.jsx` both exporting `A`, fail the build.
- Only functions written in the export get an id: a declaration, an arrow function or a function expression. Any other export, such as `export const A = wrap(B)`, keeps `fnId`'s counter. Without the plugin, every component uses the counter.

## File-based routes

Files under `routesDir` become a `@sleekstack/router` route table. `users/[id].tsx` gives the path `/users/:id`, and an `index` file gives its directory's path. A static segment matches before a param in the same position.

`virtual:sleekstack/routes` exports two objects keyed by route name, which is the file path without its extension:

- `table` maps each name to its path string. Params are inferred from the path strings, as in a hand-written table (ADR 0036).
- `pages` maps each name to the route file's default export.

In dev, adding or removing a route file rebuilds the module and reloads the page without a restart. A segment that is neither a name nor a `[param]` fails with the file's path, and so do two files that give the same path.

The plugin writes `routes.gen.d.ts` into `routesDir` (ADR 0045). The file only declares the module's types, with literal paths and each page's type, and it is rewritten on build start and when route files are added or removed. An app may commit the file or gitignore it. If it is gitignored, run `vite` or `vite build` once before a plain `tsc`.

## Client and SSR entries

With `entries`, `vite build` first builds the client environment into `dist/client`, then the `ssr` environment into `dist/server`. The server entry's default export answers a request:

```ts
import { handle } from '@sleekstack/router'
import { scripts } from 'virtual:sleekstack/client'
import { app } from './app'

const document = {
  before: `<!doctype html><html><head><meta charset="utf-8">${scripts}</head><body><div id="app">`,
  after: '</div></body></html>',
}

export default (request: Request): Promise<Response> => handle(app, request, { stream: true, document })
```

`virtual:sleekstack/client` exports `scripts`, the markup for the document head. In a build, it loads the built client chunk and every CSS file of the chunk's static import graph, or every emitted CSS file when `cssCodeSplit` is off. In dev, it contains the tags Vite's HTML transforms add (including plugin-react's refresh preamble) and loads the source client entry with HMR.

Unlike `virtual:sleekstack/routes`, this module has no generated declaration. Add one to the app, as `apps/playground/ui/src/env.d.ts` does:

```ts
declare module 'virtual:sleekstack/client' {
  /** Markup that loads the client entry, for the document head. */
  export const scripts: string
}
```

`vite build --watch` is not supported with `entries` and fails with a clear error.

## Known limitations

- **Relative `base` with `entries`:** a relative `base` such as `./` is rejected, because a page at `/users/42` would request its client chunk from `/users/assets/...`. Use an absolute `base` (the default `/`, or a path such as `/app/`).
- No HMR state preservation (fn-31), no static site generation (fn-30) and no deploy adapters.

## Vite API check (Vite 8.0.16)

Checked against the installed `vite@8.0.16` and `@vitejs/plugin-react@6.0.2`:

- Vite 8 bundles with Rolldown and transforms TS/JSX with Oxc (`vite:oxc`); esbuild is no longer the transformer. Oxc honours a per-file `@jsxImportSource` pragma only in the file's leading comments (a pragma after the first statement is ignored), so the plugin puts it at the start of line 1.
- plugin-react 6 is Babel-free: it sets `oxc.jsx` (automatic runtime, `importSource` only when given) plus Fast Refresh, and no longer transforms JSX itself. Its default `jsxImportSource` is `react`, which a file pragma overrides.
- Transform hooks take a `filter` (`transform: { filter: { id }, handler }`), which Rolldown applies before calling into JS; `createFilter(include, exclude, { resolve: root })` matches globs.
- The Environment API is available: per-environment config under `environments` (`client`, `ssr`), `this.environment` in hooks, `applyToEnvironment` / `perEnvironmentPlugin` to scope a plugin, and `config.consumer` (`client` | `server`). `createBuilder` / `builder.buildApp` build all environments, and the client and SSR builds use them.
