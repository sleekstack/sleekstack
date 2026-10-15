# showcase

One Vite app that runs `@sleekstack/ui` end to end: a team task board on Effect Layers. The page mounts the app twice, as Ada (an editor) and Grace (a viewer), each with its own atom store. The shell's page links open each demo page in a `startTransition`, so the open page stays until the next one has loaded.

## Run it

| Command | What it does |
| --- | --- |
| `pnpm --filter showcase dev` | Vite dev server, with the ui devtools panel below the two views |
| `pnpm --filter showcase build` | Production build into `dist/` (no devtools); `pnpm --filter showcase preview` serves it |
| `pnpm turbo run test typecheck --filter=showcase` | Builds the workspace packages, then runs the tests and `tsc` |
| `pnpm --filter showcase check` | `sleekstack check`: the component pass must report no diagnostics |

## Demo pages

Each page is a link in the shell (`src/pages/shell.tsx`). Each page's tests also render it on the server and hydrate the result.

| Page | Source | What it shows | Test |
| --- | --- | --- | --- |
| Board and forms | `src/pages/project.tsx`, `src/modules/` | Tasks read and written through `@sleekstack/query`; a new-task form with `useAction`, `useFormStatus` and `useOptimistic`; a `Boundary` for an unknown project; the tab title set by `useEffect`; keyed rows and React guests | `test/app.test.ts`, `test/hydrate.test.ts`, `test/stream.test.ts` |
| Typed DOM | `src/pages/dom.tsx` | Host elements typed per tag, atoms bound to attributes in place, `useRef` | `test/dom.test.tsx` |
| lazy | `src/pages/lazy.tsx`, `src/pages/chart.tsx` | A `lazy` chart in its own chunk under `Pending`, with a Retry for a failed import | `test/lazy.test.ts` |
| Transitions | `src/pages/transitions.tsx` | Tabs opened with or without `startTransition`; a filter whose matches follow `useDeferredAtom` | `test/transitions.test.ts` |
| Portal | `src/pages/portal.tsx` | A dialog rendered into `document.body` that still reads the `Viewer` its position provides | `test/portal.test.ts` |
| Boundary reset | `src/pages/boundary.tsx` | A failed read shows the fallback; its `reset` re-runs only the boundary's children | `test/boundary.test.ts` |
| Router | `src/pages/router.tsx` | A `@sleekstack/router` app that `startRouter` runs in the page: a `const` route table, a loader with a schema that the router runs before the page shows (under `Pending`), and `Link`s that prefetch it on hover or focus. Its links change the address bar | `test/router.test.ts` (also `handle` on the server) |
| Devtools | `src/pages/devtools.tsx`, `src/devtools.tsx` | Links the ui devtools panel, which `src/main.tsx` loads in development only | `test/devtools.test.ts` |

The resumable counter (`src/resume/`) has no shell page: `test/resume.test.ts` server-renders it and resumes it with no component code and no React.

## Component tests

`test/router.test.ts`, `test/portal.test.ts`, `test/boundary.test.ts` and `test/devtools.test.ts` use [`@sleekstack/testing`](../../packages/testing/README.md): `render` mounts or hydrates a page, `flush` waits until the renderer is idle, and in `test/router.test.ts` `mockLayer` replaces the identity module's `UserRepo`.

## Other checks

- `test/architecture.test.ts`: the folder layering of `src/` (one folder per domain module, imports only inward).
- `test/size.test.ts`: the size budget of ADR 0022.
- `test/fixtures.test.ts`: one fixture per error code of the Analyzer's component pass (`fixtures/`), and a clean app.

## Known limits

- `hydrateMount` keeps an atom-bound text child (`<output>{atom}</output>`) at its server value, so the hydrated demos bind atoms to attributes only.
- `sleekstack check` does not read the pages a router renders (`startRouter` is not one of its roots), so the Router page's routed pages are outside the component pass. A `<Link>` in a tree it does read is reported `Unresolved`.
- The lazy page cannot fail an import on purpose; `test/lazy.test.ts` mocks a failed one.
