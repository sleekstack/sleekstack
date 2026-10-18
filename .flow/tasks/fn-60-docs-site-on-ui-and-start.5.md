---
satisfies: [R1, R7, R8]
---
# fn-60-docs-site-on-ui-and-start.5 docs app: swap Next and fumadocs for the ui-vite build

## Description
Put the site on the platform: the Vite config with the `ui-vite` plugin, the document shell, entry files, a configurable base prefix, English only and no analytics, and remove Next, fumadocs, Tailwind and PostCSS and everything that used them.

**Size:** M
**Files:** apps/docs/package.json (scripts and dependencies), new apps/docs/vite.config.ts and src entries, tsconfig.json, README.md; deleted: apps/docs/app/, lib/, next.config.mjs, postcss.config.mjs, source.config.ts and the `next-env.d.ts`/`.next` references; pnpm-lock.yaml
**Touches:** [apps/docs/**, pnpm-lock.yaml]

### Approach
- Needs the platform spec done (fn-59). Configure the plugin with the content directory, order file, site origin, a base prefix option (default `/docs`), fonts for Open Graph images, and the search index on.
- Scripts: `dev` (Vite with the start fetch handler), `build` (prerender then the link check), `typecheck` (plain `tsc --noEmit`, no `fumadocs-mdx`), `test` stays; `generate:api`, `generate:benchmarks`, `check:links` stay and run in the pre-hooks as today.
- Dependencies go: fumadocs-core, fumadocs-ui, fumadocs-mdx, next, tailwind and postcss packages, react and react-dom (unless a surviving test still needs them: check). tsconfig drops the Next plugin and `.next/types`, adds the ui JSX settings.
- No analytics script, no tracking, and no assumption of a single URL prefix anywhere in the code.
- Check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries.

### Investigation targets
**Required**:
- `apps/docs/package.json`, `tsconfig.json`, `next.config.mjs`, `app/**`, `lib/source.ts`
- `packages/ui-vite/` options and README (from the platform spec), `apps/showcase/vite.config.ts`
- `apps/docs/src/` from tasks .3 and .4
**Optional**:
- `.flow/charts/fn-57/1.json` (fumadocs features and what replaces each)

## Acceptance
- [ ] `dev` serves the site and `build` writes the static site; every guide and API page is reachable under the base prefix and the link checker passes with a different prefix too
- [ ] `apps/docs` depends on none of kit, react, next, islands, fumadocs, Tailwind or PostCSS; a search of the app for the four package names finds nothing (positive control first)
- [ ] `pnpm turbo run typecheck build --filter=docs` is green

## Done summary
Docs app now builds with the ui-vite plugin: Vite config, shared site builder for server/browser entries, dev start entry, Open Graph font committed; Next, fumadocs, Tailwind, PostCSS and the kit/react/islands/next deps and files removed. Built site checked: 35 pages, 1186 internal links, 1658 search anchors and ids all resolve, og images present. A different base prefix works in the site code but fails the plugin's link check because content links hard-code /docs (platform gap).

Tier: implementer opus at medium (conductor line)
stage: impl-review - skipped(policy: standing user rule, per-task Codex review skipped)
## Evidence
- Commits: 6e715ed0d35c9d2212709dcd97b0e5c62df780e8
- Tests: pnpm turbo run test typecheck build --filter=docs, pnpm format:check
- PRs: