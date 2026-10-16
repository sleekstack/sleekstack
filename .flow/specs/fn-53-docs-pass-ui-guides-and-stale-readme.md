# Docs pass: @sleekstack/ui guides and stale README text

## Goal & Context
fn-43 to fn-52 landed typed DOM, `lazy`, forms, transitions, Portal and Boundary reset, testing, devtools, router and Model/Draft. Docs are uneven: forms, models, routing, testing and ui-devtools have pages; typed host elements, `lazy`, transitions and deferred atoms, Portal, Boundary reset and the `@sleekstack/ui` basics (components, hooks, slot rules) have only README rows and ADRs. The root README still calls ui an "MVP spike" and lists `@sleekstack/query` as planned although it exists.

## Acceptance
- **R1:** The docs site has a `@sleekstack/ui` guide covering components (`Component<P, E, R>`), local state and hooks (`useLocal`, `useEffect`, `useRef`, `useDerivedAtom`, `useDeferredAtom`), the slot-hook rule enforced by `sleekstack check`, handler forms (ADR 0026), `Provider`/`Provide`, keys, and mounting (`mount`, `hydrateMount`, `resume`, streaming), each linking the ADR it comes from.
- **R2:** Pages (or sections of the guide) exist for typed host elements (`class`/`className`, events, `ref`), `lazy` with `LazyLoadError`, `startTransition` and `useDeferredAtom`, and `Portal` plus `Boundary` reset; code lives in `apps/docs/snippets` and is typechecked (docs tests forbid inline fences).
- **R3:** `apps/docs/content/docs/meta.json` lists the new pages in a sensible order and every internal link resolves (docs build link check passes).
- **R4:** The root README and each package README describe the package as it is today: no "MVP spike" for ui, no planned entry for a package that exists, every package in the Packages table with a working link, and the ui README export table matches `packages/ui/src/index.ts` (every public export has a row, no row for a missing export).
- **R5:** CONTEXT.md terms match the docs (no term used in a page or README that is not in CONTEXT.md, and none of its `_Avoid_` names used).
- **R6:** No generated API doc is hand-edited (`generate:api` output only); docs tests and typecheck pass; the showcase page links the new guides.
- **R7:** No error surface beyond docs build and test failures; no package behaviour changes.

## Boundaries
- Docs, READMEs and snippets only; no package code changes.
