---
satisfies: [R1, R2]
---
# fn-6-docs-site-with-generated-api-reference.1 Docs app scaffold + TypeDoc pipeline + coverage harness

## Description
Scaffold `apps/docs` (Next 15 App Router + Fumadocs 15.8.5, Tailwind v4, local search) following `apps/showcase-kit`'s package.json, tsconfig and next.config (transpilePackages). Build the API pipeline: a shared entry-point resolver module, `generate:api` (TypeDoc + markdown plugin, title frontmatter injection, `.md` link rewrite) writing to gitignored `content/docs/api/<pkg>/<entry>`, wired to predev/prebuild/pretest. Prove it end to end on kit's 3 entry points first. If the integration fails, fall back to plain TypeDoc markdown rendered as MDX pages (spec Early proof point). Then extend it to core/next/react. Add a placeholder Introduction page. Add the `test` vitest harness with link check + API coverage test (every export has a page; the empty-summary assertion is skipped until .2 lands). Replace `apps/docs/README.md`.

Touches: apps/docs/** (creates test/links.test.ts, test/api-coverage.test.ts), pnpm-lock.yaml, .gitignore

## Acceptance
- [ ] `pnpm --filter docs build` passes; reference pages exist for all 6 entry points; search works in dev.
- [ ] An MDX error or broken internal link makes `pnpm --filter docs build` fail (negative check demonstrated).
- [ ] Coverage test enumerates exports via TS compiler API using the shared resolver (exports map, else `types`; missing file = error; react resolves `src/index.tsx`), fails on a missing page.
- [ ] Generated dir gitignored; `pnpm --filter docs dev` works on clean checkout.


## Done summary
Scaffolded apps/docs (Next 15 + Fumadocs core/ui 15.8.5, fumadocs-mdx 12.0.3, Tailwind v4, local search) with a TypeDoc pipeline (`generate:api`, one page per entry point for all 6 entry points via the shared resolver scripts/entry-points.mjs), a build-time link check (pages, fragments, reference links), and vitest link + API coverage tests (empty-summary check skipped until .2). fumadocs-mdx 11.x is incompatible with core 15.8.5 at runtime (files.map), so 12.0.3 is pinned; pnpm-workspace.yaml gained `allowBuilds: esbuild` (needed by fumadocs-mdx; outside declared Touches). Negative checks shown: MDX error and broken link both fail `pnpm --filter docs build`; removing a heading fails the coverage test. Dev on clean checkout serves /docs and /api/search.

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixed -> SHIP)
## Evidence
- Commits: aeb7d4edd2af3a75841e5fb69322fc0278918df4, 3c6e621fa45ef750feb01bae7d786f9ea9821a71
- Tests: pnpm --filter docs build, pnpm --filter docs test, pnpm --filter docs typecheck, baseline: none (docs app did not exist)
- PRs: