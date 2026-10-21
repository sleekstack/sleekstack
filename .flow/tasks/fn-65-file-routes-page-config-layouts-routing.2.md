---
satisfies: [R2]
---
# fn-65-file-routes-page-config-layouts-routing.2 ui-vite: route-file conventions (optional, splat, groups, _ ignore) and ADR 0050

Touches: packages/ui-vite/src/routes.ts, packages/ui-vite/src/__tests__/routes.test.ts, docs/adr/0050-file-routes-layouts-and-lazy-pages.md, docs/adr/README.md

## Description
Extend the file scanner: `[[id]]` is `:id?`, `[...rest]` is `*rest`, `(group)` directories add no segment, and `_`-prefixed files and directories are not routes. Write ADR 0050 (the decision record for the whole spec: conventions, page config, layouts composed at generation, lazy `load`; amends 0036 and 0045).

**Size:** M
**Files:** `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/__tests__/routes.test.ts`, `docs/adr/0050-file-routes-layouts-and-lazy-pages.md`, `docs/adr/README.md`

### Approach
- `toRoute` / `scan` / `sortKey` (`routes.ts:21-55`): today `PARAM` is `^\[(\w+)\]$`, `STATIC` allows `_x`, and `sortKey` maps `:name` to a high char so static sorts before param. Add optional and splat (last segment only, else throw naming the file), groups (kept in the route `name`, dropped from the path), and skip any path with a `_` segment (but keep room for `_layout` / `_notFound`, which tasks 3 and 5 read: have `scan` return them separately or filter by name, your call).
- Order at one position: static, `:param`, `:param?`, `*splat`. Collision: two files with the same shape (param names ignored, as `sortKey` does) still fail naming both files; `users/index` plus `users/[[id]]` is not a collision (different path strings).
- Update `declaration()` so literal paths include `?` and `*` forms. The declaration must stay types-only (ADR 0045).
- Tests first in `routes.test.ts` (it already drives scan, module code and the declaration): every convention, an ignored `_` file/dir absent from imports and the declaration, errors naming files. Add a `Params` type check through the declaration if the existing test does that for params.
- ADR 0050: the full decision set from the spec's Architecture section (use ADR 0045's layout: Status / Context / Decision / Consequences / Rejected). Add the row to `docs/adr/README.md` and the amendment note to 0036 and 0045 status lines.

### Investigation targets
**Required**:
- `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/__tests__/routes.test.ts`
- `docs/adr/0045-vite-plugin-route-declaration.md`, `docs/adr/README.md`

### Acceptance
- [ ] `[[id]]`, `[...rest]`, `(group)` give the right path, name and order; misplaced optional or splat fails naming the file
- [ ] A `_` file or directory is not a route and does not appear in the module or the declaration
- [ ] Collisions still fail naming both files; static, param, optional, splat order holds
- [ ] ADR 0050 written and linked from the ADR index; 0036 and 0045 point at it
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` green

## Acceptance
- [ ] TBD

## Done summary
Route files now support `[[id]]` (`:id?`), `[...rest]` (`*rest`), `(group)` directories (no path segment, kept in the route name) and ignore any file or directory starting with `_`; optional and splat must be the last segment or the file fails with its path. Routes sort static, `:param`, `:param?`, `*splat` at each position, and collisions (including through groups) name both files. ADR 0050 records the spec's whole decision set; the ADR index lists it and 0036/0045 status lines point at it.

Tests (`packages/ui-vite/src/__tests__/routes.test.ts`): conventions + order + match, `_` ignore (table, pages, declaration), literal `?`/`*` path types in the declaration, and errors naming files (invalid segment, misplaced optional, misplaced splat, collision, collision through groups). The old `__proto__.ts` route case became `constructor.ts`, since `_` files are no longer routes (declared change, ADR 0050). `scan` simply drops every `_` path; tasks 3 and 5 read `_layout` / `_notFound` themselves.

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out, 3 draws SHIP, rid 5bb1426f68e44f8ea0d144f13a03421d)
## Evidence
- Commits: d9226182e59065c57b9e0e08b216098d98f71b2f
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld
- PRs: