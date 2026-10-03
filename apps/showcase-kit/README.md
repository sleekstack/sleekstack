# SleekStack Showcase (kit)

The [showcase](../showcase/README.md) team task board, ported to `@sleekstack/kit` only: no file here imports
`effect` or `@sleekstack/(core|next|react)` (asserted by `src/__tests__/no-effect.test.ts`).

## What it shows

| Req | What | Files |
| --- | --- | --- |
| R8 | `/graph`: the analyzer report (`pnpm report`) of `AppModule`; demo mode shows the Shadowing | `app/graph/page.tsx`, `src/__tests__/parity.test.ts` |
| R9 | Board, nested `LayerProvider`s, demo-mode Shadowing via per-call `provide`, `/log` | `app/`, `src/client/`, `src/server/`, `src/domain/` |
| R9 | `/errors`: every graph-error case via the kit API, showing `SleekStackError.code` | `src/errors/cases.server.ts`, `app/errors/page.tsx`, `src/__tests__/errors.test.ts` |
| R9 | 20 concurrent requests isolated, rollback leaves the store unchanged, StrictMode | `src/__tests__/requests.test.ts`, `src/__tests__/board.test.tsx` |
| R9 | Bundle split: marker absent from client chunks, present on the server | `src/domain/modules.server.ts`, `src/__tests__/bundle.test.ts` |
| fn-10 | `/islands`: every Islands trigger, click replay, shared app scope, a kit action from an Island | `app/islands/`, `src/islands/`, `e2e/islands.spec.ts`, `src/__tests__/bundle.test.ts` |
| R9 | Playwright smoke against `next start` | `e2e/smoke.spec.ts`, `playwright.config.ts` |

## Queries and mutations

The board is read through the kit `cachedQuery` `board` (`src/client/board-query.ts`), whose fetch is the `readBoard`
Server Action, and written through one `mutation()` per action. `useBoardMutation` writes the expected board into the cache
with `useQueryClient().setData`, restores it when the action returns `{ ok: false }` ("Simulate failure"), and invalidates
the board afterwards; no mutation calls `router.refresh()`. The kit facade has no server prefetch yet, so the server render
shows a placeholder and the client fetches the board on mount (the Effect showcase prefetches and hydrates instead). The demo
toggle still refreshes the router: the remount resets the query store and the board is fetched again under demo mode.

## Side by side with the Effect version

| Effect showcase | Kit showcase |
| --- | --- |
| `Context.Tag` classes | `tag<T>(name)` |
| `declareLayer(Layer.effect(Tag, ...))` | `layer(Tag, (a, b) => value, [A, B])` |
| `module({ entries })` + `makeAppScope(entries)` | `module({ provide })` + `configureRuntime({ provide })` |
| `action(Effect.gen(...))` | `defineEffect(function* (...args) { const a = yield* A; ... })` |
| `_tag` errors (`Data.TaggedError`) | one `SleekStackError` with `code` |

The Effect version's `declareLayer` and bare-Layer nodes have no kit counterpart, so those rows are absent from /graph here.

## Running

```bash
pnpm --filter showcase-kit dev          # http://localhost:3000
pnpm --filter showcase-kit typecheck
pnpm --filter showcase-kit test         # bundle test skips without a build
pnpm --filter showcase-kit build && pnpm --filter showcase-kit test:bundle
pnpm --filter showcase-kit exec playwright install chromium   # once
pnpm --filter showcase-kit build && pnpm --filter showcase-kit test:e2e   # port 3200
```
