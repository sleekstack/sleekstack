---
satisfies: [R4, R6]
---
# fn-29-sleekstack-vite-plugin.5 Client and SSR builds with example app on the plugin

## Description
Wire `entries` and Vite environments so `vite build` yields client and SSR bundles; dev and build SSR render through `renderToStream` (fn-27). Move ui-demo (or add an example) onto the plugin.

**Size:** M
**Files:** packages/ui-vite/src/entries.ts, src/index.ts, example app config, e2e test
**Touches:** [packages/ui-vite/src/**, apps/playground/**]

### Approach
- Check which of apps/* hosts ui-demo before editing.
- Test: built bundles render and hydrate the example.

### Acceptance
- [ ] Client and SSR bundles build, render, hydrate (R4)
- [ ] Example runs on the plugin (R6)

## Acceptance
- [ ] TBD

## Done summary
`sleekstack({ entries: { client, server } })` (new `packages/ui-vite/src/entries.ts`) sets up the `client` and `ssr` Vite environments. `vite build` builds `dist/client`, then `dist/server`. The server entry's default export is a fetch handler, and `virtual:sleekstack/client` gives it the built client script and CSS links. In dev, the plugin answers requests through the server entry in the ssr environment, with the tags Vite's HTML transforms add. The example is `apps/playground/ui`: a router app on the plugin, streamed by `handle(..., { stream: true })` (`renderToStream`) and hydrated by `startRouter`. `apps/playground/src/__tests__/ui-example.test.ts` builds both bundles (cssCodeSplit on and off), renders the page, and hydrates it, keeping the server's button node. It also checks dev SSR with `react()` beside the plugin (R4, R6).

Review fixes: plugin-react's refresh preamble now reaches dev SSR pages; CSS links now cover the client's whole static graph, and every emitted CSS file when cssCodeSplit is off; `--watch` with entries now gives a clear error; and `ids.ts` handles an anonymous default generator with comments before `*`.

Follow-ups:
- `@sleekstack/ui` hydration: when the stream's inline scripts are left in the container, as a browser leaves them, `hydrateMount` reports HydrationMismatch and falls back to mount. The test runs and then drops them, as the router's tests do. The fix belongs in ui's hydrate, which is outside this task's Touches.
- The analyzer reads router `pages` only as an object literal, so the example writes its pages out instead of using `pages` from `virtual:sleekstack/routes`.
- `virtual:sleekstack/client` needs an app-side declaration (`ui/src/env.d.ts`). Task 6 docs should cover it.

Outside declared Touches: `pnpm-lock.yaml` for the playground's new deps (`@sleekstack/ui`, `@sleekstack/router`, `@sleekstack/ui-vite`, `jsdom`, `@types/node`).
baseline: green (pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...)

stage: impl-review - ran (codex fan-out NEEDS_WORK: 4 findings fixed, SHIP on re-review, base master)
## Evidence
- Commits: 54194eeb30e1b9abf8df82e5f6191678426b5a0e, aad4501b9818b47227cc21119d6a1f81f8506a87
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite..., pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite... --filter=sleekstack-playground
- PRs: