# 0022: `@sleekstack/ui` size budget and publish gate

**Status:** Accepted

`@sleekstack/ui`, `@sleekstack/core` and `@sleekstack/query` build with plain `tsc` to `dist/` (fn-26). `ui` stays `"private": true`. This ADR records the consumer size budget, measured on that built output after hydration (ADR 0016) landed, and what has to hold before the package is published.

## Method

The ADR 0017 method, in `apps/ui-demo/test/size.test.ts`: an in-process Vite production lib build of one entry, minified, `process.env.NODE_ENV` defined as `"production"` (an app build does this; lib mode does not, and React would otherwise bundle its development build too). The measured size is the entry chunk plus its static imports, gzipped; lazy chunks are reported apart. Each entry is built twice: against the packages' `dist` (through their `exports`) and with the workspace packages aliased to `src`.

Entries in `apps/ui-demo/src`:

- `size/mount.tsx`: `mount(<h1>Hello</h1>)` with `Layer.empty`.
- `size/hydrate.tsx`: one reactive component (`useAtom` on a serializable atom, an `onClick` closure) under `hydrateMount`.
- `resume/entry.ts`: the ADR 0017 resume entry.
- `size/lazy.tsx`: `mount` of a `Pending` around a `lazy(() => import('./heavy'))` component (fn-48).

## Measured size

| Entry | Minified | Gzip | Limit (gzip) |
|-------|----------|------|--------------|
| `mount` hello-world | 743,516 B | 192,781 B | 203,000 B |
| Hydrating app | 830,100 B | 213,941 B | 225,000 B |
| Resume | 304,111 B | 78,637 B (lazy handler 180 B) | 83,000 B |
| `lazy` mount | 763,154 B | 199,309 B (lazy chunk 277 B) | 209,000 B |

Source and dist builds differ by at most 3 bytes, so the tsc build costs nothing. Limits are the measurement plus about 5%; the test fails above them. A change that raises a number on purpose updates the limit and this table together.

`mount` and `hydrateMount` include React and React DOM: `dom.ts` imports `react-dom/client` statically for guests, so an app without guests still ships them. The rest is mostly Effect. `resume` has no React path. Tree-shaking is verified: the mount-only bundle contains neither the resume runtime (`ManifestDecodeFailed`) nor the query bridge (`QueryFailed`). Code splitting is verified: the `lazy` entry's imported module is in its own chunk, not the eager bundle.

## Publish gate

`ui` (and `core`, `query`) stay `private: true` until all of these hold:

1. `apps/showcase` is ported to `@sleekstack/ui` and runs on the built packages.
2. The tarball consumer test (`packages/ui/src/__tests__/pack.test.ts`) and the size budget test pass.
3. A release process (versioning, changelog) is decided in its own ADR.

Publishing is a change to this ADR's status, not a silent edit of `private`.

## Considered options

- **Assert relative limits only (no absolute numbers):** rejected. A slow drift passes every relative check.
- **Lazy-load the React guest path now:** deferred. It would shrink the `mount` figure, but it changes `mount`'s guest commit path and is outside a measurement spec.

## Consequences

- Two `effect` copies in one app are unsupported (README, Installing).
- Importing the output from Node-native ESM is unsupported; consumers use a bundler.
