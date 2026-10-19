# 0022: `@sleekstack/ui` size budget and publish gate

**Status:** Accepted

`@sleekstack/ui`, `@sleekstack/core` and `@sleekstack/query` build with plain `tsc` to `dist/` (fn-26). `ui` stays `"private": true`. This ADR records the consumer size budget, measured on that built output after hydration (ADR 0016) landed, and what has to hold before the package is published.

## Method

The ADR 0017 method, in `apps/showcase/test/size.test.ts`: an in-process Vite production lib build of one entry, minified, `process.env.NODE_ENV` defined as `"production"` (an app build does this; lib mode does not, and React would otherwise bundle its development build too). The measured size is the entry chunk plus its static imports, gzipped; lazy chunks are reported apart. Each entry is built twice: against the packages' `dist` (through their `exports`) and with the workspace packages aliased to `src`.

Entries in `apps/showcase/src`:

- `size/mount.tsx`: `mount(<h1>Hello</h1>)` with `Layer.empty`.
- `size/hydrate.tsx`: one reactive component (`useAtom` on a serializable atom, an `onClick` closure) under `hydrateMount`.
- `resume/entry.ts`: the ADR 0017 resume entry, with a click handler and a form action (fn-51).
- `size/lazy.tsx`: `mount` of a `Boundary` and `Pending` around a `lazy(() => import('./heavy'))` component (fn-48).
- `size/model.tsx`: `mount` of a component with one Draft from `@sleekstack/model` (fn-56, ADR 0040).
- `size/records.tsx`: `mount` of a component reading one record with `useRecord` and editing it with its derived Draft, over an adapter Layer (fn-58).

## Measured size

| Entry                 | Minified  | Gzip                           | Limit (gzip) |
| --------------------- | --------- | ------------------------------ | ------------ |
| `mount` hello-world   | 765,838 B | 200,038 B                      | 203,000 B    |
| Hydrating app         | 853,218 B | 221,281 B                      | 225,000 B    |
| Resume                | 307,040 B | 79,447 B (lazy handlers 229 B) | 83,000 B     |
| `lazy` mount          | 773,136 B | 203,096 B (lazy chunk 284 B)   | 209,000 B    |
| `mount` with a Draft  | 853,317 B | 221,223 B                      | 231,000 B    |
| `mount` with a record | 860,026 B | 223,393 B                      | 233,000 B    |

Remeasured after fn-56 (Model and Draft move to `@sleekstack/model`, ADR 0040), with the fn-45 render observer unattached, all within the limits. Against master before the move, `ui`'s entries shrank: `mount` hello-world from 198,667 B, the hydrating app from 220,221 B and `lazy` mount from 201,154 B gzip; the test kept these pre-move sizes as a second bound on those entries until the fn-59 merge. A `mount`-only bundle holds no Draft code (`useDraft`); the Draft entry measures the cost of opting in. Source and dist builds differ by at most 3 bytes, so the tsc build costs nothing. Limits are the measurement plus about 5%; the test fails above them. A change that raises a number on purpose updates the limit and this table together.

Remeasured after fn-58 (the records layer in `@sleekstack/model`). The Draft entry's limit is unchanged; the records entry costs about 2.2 KB gzip over it. A bundle importing only `useDraft` holds no records code and none of `@sleekstack/query`, which only the `@sleekstack/model/query` entry loads (`packages/model/src/__tests__/bundle.test.ts`).

Remeasured after merging fn-59 with master (fn-31 HMR, fn-33 `Head` per ADR 0044, fn-59 void elements per ADR 0046). The `mount`, hydrating and `lazy` entries grew by about 1.1 to 2 KB gzip over the fn-58 numbers, from `Head` and HMR; void elements cost 0 B there, since `serialize` is not in a `mount` bundle. That growth crossed the pre-move bounds (`uiBeforeModel`: 198,667 B, 220,221 B, 201,154 B), so the test drops them on purpose: they checked the fn-56 move, and `ui` has since grown by decision. The limits did not move; all entries are within them.

`mount` and `hydrateMount` include React and React DOM: `dom.ts` imports `react-dom/client` statically for guests, so an app without guests still ships them. The rest is mostly Effect. `resume` has no React path. Tree-shaking is verified: the mount-only bundle contains neither the resume runtime (`ManifestDecodeFailed`) nor the query bridge (`QueryFailed`). Code splitting is verified: the `lazy` entry's imported module is in its own chunk, not the eager bundle.

## Publish gate

`ui` (and `core`, `query`) stay `private: true` until all of these hold:

1. `apps/showcase` (the `@sleekstack/ui` app since fn-51 replaced the Next.js showcase) runs on the built packages.
2. The tarball consumer test (`packages/ui/src/__tests__/pack.test.ts`) and the size budget test pass.
3. A release process (versioning, changelog) is decided in its own ADR.

Publishing is a change to this ADR's status, not a silent edit of `private`.

## Considered options

- **Assert relative limits only (no absolute numbers):** rejected. A slow drift passes every relative check.
- **Lazy-load the React guest path now:** deferred. It would shrink the `mount` figure, but it changes `mount`'s guest commit path and is outside a measurement spec.

## Consequences

- Two `effect` copies in one app are unsupported (README, Installing).
- Importing the output from Node-native ESM is unsupported; consumers use a bundler.
