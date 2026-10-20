---
satisfies: [R3]
---
# fn-65-file-routes-page-config-layouts-routing.3 ui-vite: page config exports, _notFound and Page-shaped pages

Touches: packages/ui-vite/src/routes.ts, packages/ui-vite/src/__tests__/routes.test.ts, apps/playground/ui/src

## Description
Make a route file a whole page. Its default export stays the component; named exports `loaders`, `fallback` and `prerender` become the rest of the `Page`. `virtual:sleekstack/routes` exports `pages` as `Page` objects, and `notFound` from a root `_notFound.tsx`, so `router({ table, pages, notFound })` accepts them. The declaration types each page from its route module.

**Size:** M
**Files:** `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/__tests__/routes.test.ts`, `apps/playground/ui/src/app.tsx` and its routes (use the new exports)

### Approach
- `moduleCode` (`routes.ts:57-64`) imports each file's default and emits `pages = { name: p0 }`. Change it to import the module namespace and emit `{ render: () => jsx(m.default, {}), loaders: m.loaders, fallback: m.fallback, prerender: m.prerender }` (omit absent exports so a page has no `undefined` keys). Import `jsx` from `@sleekstack/ui/jsx-runtime`, as `packages/router/src/resolve.ts` does for `view`. Export `notFound` as `() => jsx(Default, {})` only when `_notFound` exists.
- `declaration()` (`routes.ts:66-80`) types `pages[name]` today as `typeof import('./x').default`. Type it from the whole module so `router()`'s `PageNeeds` (`resolve.ts:56-60`, reads `render` and `loaders` requirements) infers like a hand-written page. A small exported helper type in `@sleekstack/ui-vite` (types only) is fine if the module type alone does not infer.
- A route or `_notFound` file with no default export fails naming the file (at module load, `this.error`). Missing `_notFound` means no `notFound` export and no declaration entry.
- `prerender` enumeration (`packages/ui-vite/src/prerender/enumerate.ts:13-16`) reads `pages[name].prerender`: check it works against the generated pages unchanged.
- Tests first: generated code through `ssrLoadModule` (see how `routes.test.ts` does it), declaration typechecked by a TS consumer (memory bug note: test the declaration with a real TS consumer, and emit computed keys).
- Use the new exports in `apps/playground/ui` so its `app.tsx` stops writing pages out (it can keep a literal until task 4 lands: do the minimum so the playground still builds and its test passes).

### Investigation targets
**Required**:
- `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/__tests__/routes.test.ts`
- `packages/router/src/resolve.ts:34-70`, `packages/ui-vite/src/prerender/enumerate.ts`
- `.flow/memory/bug/integration/virtual-module-needs-a-declaration-and-2026-10-18.md`
- `apps/playground/ui/src/app.tsx`

### Acceptance
- [ ] A route file's `loaders`, `fallback`, `prerender` reach its `pages` entry; absent exports leave no key
- [ ] `_notFound` default becomes `notFound`; no file means no export and a type error on import
- [ ] A TS consumer typechecks `router({ table, pages, notFound })` from the module and infers requirements as for a hand-written router
- [ ] A route or `_notFound` with no default export fails naming the file; the declaration stays types-only
- [ ] Prerender enumeration works against the generated pages
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... --filter=sleekstack-playground` green

## Acceptance
- [ ] TBD

## Done summary
`virtual:sleekstack/routes` now gives a `Page` per route file: `render` draws the default export, and the file's `loaders`, `fallback` and `prerender` exports are copied over when the file has them, so a page never carries an `undefined` key. A root `_notFound` file becomes the `notFound` export; without one there is no export and importing it is a type error. `routes.gen.d.ts` stays types-only and types each page from its route module (`Page<typeof import('./x')>`, an inline Pick of those three exports plus a JSX render), so `router({ table, pages, notFound })` infers the same requirements as a hand-written router. A route or `_notFound` file with no runtime default export fails at module load, naming the file. Type-only defaults count as missing: those are default interfaces, `export type { X as default }` and `export { type X as default }`.

Tests in `packages/ui-vite/src/__tests__/routes.test.ts`:
- the page shape and rendering, plus `notFound`
- prerender enumeration run on the generated pages
- the absent-`notFound` type error
- a TS consumer showing that `router()` from the module and a hand-written router infer the same requirements (`Db`)
- the no-default cases, the three type-only forms among them

The test server now symlinks the package's `node_modules` into its temp root, so the generated `@sleekstack/ui/jsx-runtime` import and the TS consumer resolve.

Playground: the routes module's `pages` and `notFound` cannot go straight into `router()` yet. `sleekstack check` (the analyze plugin) fails the build with "Router pages are not a readable object literal" until task 4. So `app.tsx` keeps its render literal and takes only `prerender` from `users/[id].tsx`'s new export. `routes.gen.d.ts` was regenerated. No `_notFound.tsx` was added, since the analyzer also rejects a module-imported `notFound`.

baseline: green (`pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... --filter=sleekstack-playground`)

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out rid a20f0a82f41d451cbb1dbb9f40263a3b: 1 NEEDS_WORK on type-only defaults, fixed; re-review SHIP)
## Evidence
- Commits: 1c7913dd1049e2bb28f40a7e63119ae5c1c45e12, 235a9bc86e833ddebec57172562f7b6645e9a90b
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld --filter=sleekstack-playground, npx prettier --check (changed files)
- PRs: