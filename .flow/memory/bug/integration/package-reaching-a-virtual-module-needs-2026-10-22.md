---
title: Package reaching a virtual module needs a plugin-redirected stand-in
date: "2026-10-22"
track: bug
category: integration
module: packages/ui-vite/src/server-services.ts
tags: [vite, virtual-module, vitest, start, discovery]
problem_type: integration
symptoms: Literal virtual import broke jsdom tests and SSR builds without the plugin
root_cause: Unresolvable literal dynamic import of a plugin-only virtual id in a shared package
resolution_type: fix
related_to: [bug/integration/build-time-id-duplicate-check-must-use-2026-10-18, bug/integration/node-loaded-packages-vite-plugins-need-2026-10-18, bug/integration/ssr-page-tags-must-come-from-vites-html-2026-10-18, bug/integration/start-client-stub-must-be-a-form-action-2026-10-17, bug/integration/start-request-services-set-cookie-2026-10-17, bug/integration/virtual-module-needs-a-declaration-and-2026-10-18, bug/integration/vite-plugin-memo-must-reset-per-build-2026-10-18]
---

## Problem
`start()` must read `virtual:sleek/server-app`, which only the `serverServices()` plugin serves. A literal `import('virtual:sleek/server-app')` in start broke every consumer without the plugin: vitest jsdom (client) transforms fail with "Failed to resolve import" (all of `@sleekstack/testing`'s tests), and `vite build --ssr` fails in Rolldown. Review then flagged that consumers importing the virtual module got TS2307, and that an externalized start never sees the redirect.

## What Didn't Work
- Sniffing `ERR_MODULE_NOT_FOUND` around the literal import: it covers the runtime but not the client transform or the build.
- Forcing `ssr.noExternal: ['@sleekstack/start']` from the plugin: vitest maps it to `server.deps.inline`, and realworld's suite went from ~2s to ~60s of imports, with two timeouts.
- A `/// <reference path>` to a script `.ts` file: tsc drops it from the emitted `.d.ts`.

## Solution
- start imports a real stand-in, `packages/start/src/discovered.ts` (default `undefined`, meaning nothing discovered). The plugin's `resolveId` (`order: 'pre'`, before Vite's resolver) redirects `./discovered` imported from start's `start.js` to `\0virtual:sleek/server-app`. Without the plugin, the stand-in resolves everywhere.
- The ambient declaration lives in a script file, `packages/start/src/server-app.ts`, pulled in by a side-effect `import './server-app'` in index. tsc keeps side-effect imports in `.d.ts`.
- Externalization is moot. start's dist uses extensionless relative imports, so Node alone cannot load it, and it must be bundled.

## Prevention
A package reaching a plugin-served virtual module needs a real fallback module that the plugin redirects. Test it with no plugin in a jsdom vitest run and in an SSR build. Never set `ssr.noExternal` in a shared plugin without timing a vitest suite.
