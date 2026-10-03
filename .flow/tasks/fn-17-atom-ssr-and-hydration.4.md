---
satisfies: [R5]
---
# fn-17-atom-ssr-and-hydration.4 Next prefetchAtoms and showcase SSR atom page with e2e

Touches: packages/next/src/**, packages/next/package.json, apps/showcase/app/**, apps/showcase/src/client/**, apps/showcase/e2e/**

## Description
Size: M. Next integration via server-component prefetch plus the showcase proof (R5).

**Touches:** packages/next/src/**, packages/next/package.json, apps/showcase/app/**, apps/showcase/src/client/**, apps/showcase/e2e/**

**Files:**
- `packages/next/src/atoms.ts` - new `prefetchAtoms(atoms: ReadonlyArray<Serializable<Atom<any>>>, options?)` (brand from .1); export from `packages/next/src/index.ts`
- `packages/next/src/__tests__/atoms.test.ts` - new
- `packages/next/package.json` - `@sleekstack/core` dependency if not already present
- `apps/showcase/app/atoms/page.tsx` - new async server component: `const snapshot = await prefetchAtoms([...])`, renders a client component under `<LayerProvider hydrate={snapshot}>`
- `apps/showcase/src/client/` - serializable atoms (one `Atom.serializable.result` Effect atom with a visible run counter, one sync `Atom.serializable`) and the client reader; atoms module importable from both server and client (no `'use client'`), see `services/app-atoms.ts`
- `apps/showcase/e2e/atoms.spec.ts` - new

## Approach
- `prefetchAtoms` body: one `runEffect` (`packages/next/src/runtime.ts:45`) of an Effect that takes `Effect.context()`, builds `makeAtomStore({ context })` inside `Effect.acquireRelease` (release = `store.dispose`), reads each atom, waits (subscribe + Deferred) until each result atom leaves `Initial`, then returns `dehydrate(store)`. `runEffect` already handles request layers, control flow and rejection.
- Page renders dynamically (it reads per-request data); the client `LayerProvider` SSR pass uses the inert store from .2 seeded by `hydrate`, so server HTML contains the values with no Effect run in the SSR pass.
- Run counter: increment inside the Effect and expose it via the existing showcase API routes or a DOM attribute rendered from a non-seeded source; e2e reads it after hydration to prove zero client runs.
- e2e: `request.get('/atoms')` HTML contains the value; `page.goto('/atoms')`, wait for hydration, assert the counter did not move and no fetch/Effect fired.

## Investigation targets
**Required:**
- `packages/next/src/runtime.ts`, `packages/runtime/src/runtime.ts` - `runEffect` request scope
- `apps/showcase/app/page.tsx`, `apps/showcase/app/providers.tsx` - server page + client provider patterns
- `apps/showcase/playwright.config.ts`
**Optional:**
- `apps/showcase/README.md` - requirement table row

## Acceptance
- [ ] `@sleekstack/next` exports `prefetchAtoms`; unit tests: success snapshot, `Failure` omitted, run failure rejects, store disposed on success and failure
- [ ] Type test: an unbranded atom passed to `prefetchAtoms` fails (`@ts-expect-error`); the branded twin compiles
- [ ] `/atoms` server HTML contains the seeded atom values
- [ ] e2e asserts the seeded Effect atom does not run on the client
- [ ] Existing showcase e2e and unit tests still pass

## Done summary
Added `prefetchAtoms` to @sleekstack/next. It builds an atom store on the request-scoped runtime, waits for result atoms to settle, and returns a plain-object Snapshot. The store is disposed on every path. A failed read rejects. Added the showcase `/atoms` page, which seeds a client LayerProvider via `hydrate`. An e2e checks that the server HTML contains the seeded values and that the seeded Effect never runs on the client after hydration. Tests: packages/next/src/__tests__/atoms.test.ts, apps/showcase/e2e/atoms.spec.ts. I confirmed the e2e goes red with an empty `hydrate`.

stage: impl-review - ran (codex fan-out NEEDS_WORK, 2 findings fixed, re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: d15e55b3ce31187e598410167a47a547d6fad69f, 2c297b10b934a788c34e67eddc2d269cec167d3b
- Tests: pnpm typecheck, pnpm test, pnpm --filter showcase build && npx playwright test (6/6)
- PRs: