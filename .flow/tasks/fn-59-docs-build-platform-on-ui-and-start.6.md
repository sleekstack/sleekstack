---
satisfies: [R4, R9]
---
# fn-59-docs-build-platform-on-ui-and-start.6 ui-vite: Open Graph images and the og tags

## Description
Generate one 1200 by 630 PNG per route at build time and emit the Open Graph and Twitter-card tags that point to it with an absolute URL.

**Size:** M
**Files:** packages/ui-vite/src/og.ts, index.ts (options), tests in packages/ui-vite/src/__tests__/, packages/ui-vite/README.md
**Touches:** [packages/ui-vite/**, pnpm-lock.yaml]

### Approach
- Render a plain layout tree (object form, not ui JSX: ui's elements are Effect-based and cannot feed it) with satori to SVG, then `@resvg/resvg-js` to PNG; fonts are read from configured files and passed as buffers; text is emitted as paths so rasterizing needs no fonts. Measured in the D12 probe: about 350 ms for 40 images, satori 25 MB unpacked, resvg native binary 3.4 MB per platform.
- The image title and description come from page frontmatter; output goes to `/og/<slug>.png`.
- Head tags: `og:title`, `og:description`, `og:image` (absolute: site origin joined to the path), `og:image:width`, `og:image:height`, `og:image:alt`, `og:url`, `og:type`, plus `twitter:card` set to `summary_large_image`; head dedupe already handles `meta[property]`.
- Options: site origin, font files, an off switch; with the switch off no image is written and no `og:image` is emitted. An `og:image` without a configured origin fails the build; a missing font file fails the build.
- Check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries.

### Investigation targets
**Required**:
- `.flow/charts/fn-57/12.json` (the research answer, sources and versions)
- `packages/ui-vite/src/prerender.ts` (from task .5) and `packages/ui/src/head.ts`
- `packages/ui-vite/src/index.ts` (plugin options)
**Optional**:
- https://github.com/vercel/satori, https://github.com/thx/resvg-js (the research cites them)

## Acceptance
- [ ] A build writes a 1200 by 630 PNG per route and each page carries the full og and twitter tag set with an absolute `og:image`
- [ ] A missing font file or a missing site origin (with images on) fails the build with a clear message; with the switch off no image and no `og:image`
- [ ] A test inspects a generated PNG's size and that the page's tags reference it
- [ ] `pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...` is green

## Done summary
Added the `og` plugin option (satori + @resvg/resvg-js, one 1200x630 PNG per page at og/<name>.png from frontmatter title/description) and a browser-safe `ogMeta` helper (subpath `@sleekstack/ui-vite/og-meta`) that the server entry's <Head> uses for og:* and twitter:card tags with an absolute og:image. Missing font, empty site, or off switch behave per spec.

stage: impl-review - skipped(policy: standing user rule, per-task Codex review skipped)
## Evidence
- Commits: 310eab19f03e81bcb63fd3e2c4bca56f9db598a9
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite..., pnpm run format:check
- PRs: