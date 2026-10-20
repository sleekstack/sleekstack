# 0045. The Vite plugin writes a types-only declaration for file-based routes

## Status

Accepted. Amends ADR 0036's "there is no code generation" for apps that use file-based routes through `@sleekstack/ui-vite`. Built in spec fn-29. Amended by ADR 0050: `_` files are not routes, and the declaration types each page from its route module.

## Context

ADR 0036 makes a route table a `const` object of path strings, so params are typed from the strings with no generated tree. The Vite plugin (fn-29) builds that table from route files and serves it as the virtual module `virtual:sleekstack/routes`. Virtual modules are code at build time but have no type for TypeScript: `tsc`, the editor and `sleekstack check` see the import as unresolved, or as `any` under a hand-written wildcard declaration, which drops the literal path strings that `Params` reads.

## Decision

- **The plugin writes `routes.gen.d.ts` inside `routesDir`.** It declares `virtual:sleekstack/routes` with `table` (each route name mapped to its literal path string) and `pages` (each route name mapped to its file's default export type). Placing it in `routesDir` means the app's existing tsconfig `include` already picks it up.
- **Types only.** The file has no runtime code. The route table the app runs is still the module the plugin serves at build and dev time, so no generated file is imported or bundled.
- **Written when it changes**: on build start and in dev when a route file is added or removed. An invalid route file leaves the previous declaration in place; the module load reports the error with the file's path.
- **Committing it is the app's choice.** Commit it so a plain `tsc` works without first running Vite, or gitignore it and let the first `vite` or `vite build` write it. The playground example commits it.

## Consequences

- A file-based table and a hand-written table give the same types, as ADR 0036 requires; only the declaration of the virtual module is generated, never the table.
- The generated file is the one exception to "no code generation". It stays types-only: a later need for generated runtime code needs a new ADR.
- Apps that write their route table by hand are unaffected and get no generated file.

## Rejected

- A hand-written `declare module 'virtual:sleekstack/routes'` in each app: the app would retype every path string by hand, and the declaration would drift from the route files.
- A TypeScript language-service plugin that types the virtual module: `tsc` and `sleekstack check` do not load language-service plugins.
