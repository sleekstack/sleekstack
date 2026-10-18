# @sleekstack/ui-vite

The SleekStack Vite plugin.

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sleekstack } from '@sleekstack/ui-vite'

export default defineConfig({
  plugins: [react(), sleekstack({ include: 'src/islands/**' })],
})
```

| Option                | What it does                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `include` / `exclude` | Globs (relative to the Vite root) or regexes of `.jsx` / `.tsx` files that are ui JSX without the pragma. A file that already names a `@jsxImportSource` keeps it. |

## JSX

ui JSX stays opt-in per file (ADR 0015). The plugin sets no global `jsxImportSource`:

- A file with `/** @jsxImportSource @sleekstack/ui */` compiles against `@sleekstack/ui/jsx-runtime`.
- A file matched by `include` (and not by `exclude`) gets that pragma added.
- Any other file is left to the default: React JSX, from `@vitejs/plugin-react` for guest files.

## Vite API check (Vite 8.0.16)

Checked against the installed `vite@8.0.16` and `@vitejs/plugin-react@6.0.2`:

- Vite 8 bundles with Rolldown and transforms TS/JSX with Oxc (`vite:oxc`); esbuild is no longer the transformer. Oxc honours a per-file `@jsxImportSource` pragma only in the file's leading comments (a pragma after the first statement is ignored), so the plugin puts it at the start of line 1.
- plugin-react 6 is Babel-free: it sets `oxc.jsx` (automatic runtime, `importSource` only when given) plus Fast Refresh, and no longer transforms JSX itself. Its default `jsxImportSource` is `react`, which a file pragma overrides.
- Transform hooks take a `filter` (`transform: { filter: { id }, handler }`), which Rolldown applies before calling into JS; `createFilter(include, exclude, { resolve: root })` matches globs.
- The Environment API is available: per-environment config under `environments` (`client`, `ssr`), `this.environment` in hooks, `applyToEnvironment` / `perEnvironmentPlugin` to scope a plugin, and `config.consumer` (`client` | `server`). `createBuilder` / `builder.buildApp` build all environments; client and SSR builds (fn-29 task 5) use these.
