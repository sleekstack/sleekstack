# SleekStack Showcase (kit)

The [showcase](../showcase/README.md) team task board, ported to `@sleekstack/kit` only: no file here imports
`effect` or `@sleekstack/(core|next|react)` (asserted by `src/__tests__/no-effect.test.ts`).

## What it shows

| Req | What | Files |
| --- | --- | --- |
| R8 | `/graph`: kit `snapshot(AppModule)` in core's shape; demo mode shows the Shadowing | `app/graph/page.tsx`, `src/__tests__/graph.test.ts` |
| R9 | Board, nested `LayerProvider`s, demo-mode Shadowing via per-call `provide`, `/log` | `app/`, `src/client/`, `src/server/`, `src/domain/` |
| R9 | `/errors`: every graph-error case via the kit API, showing `SleekStackError.code` | `src/errors/cases.server.ts`, `app/errors/page.tsx`, `src/__tests__/errors.test.ts` |
| R9 | 20 concurrent requests isolated, rollback leaves the store unchanged, StrictMode | `src/__tests__/requests.test.ts`, `src/__tests__/board.test.tsx` |
| R9 | Bundle split: marker absent from client chunks, present on the server | `src/domain/modules.server.ts`, `src/__tests__/bundle.test.ts` |
| fn-10 | `/islands`: every Islands trigger, click replay, shared app scope, a kit action from an Island | `app/islands/`, `src/islands/`, `e2e/islands.spec.ts`, `src/__tests__/bundle.test.ts` |
| R9 | Playwright smoke against `next start` | `e2e/smoke.spec.ts`, `playwright.config.ts` |

## Side by side with the Effect version

| Effect showcase | Kit showcase |
| --- | --- |
| `Context.Tag` classes | `tag<T>(name)` |
| `service(Tag, { requires }, ([a, b]) => Effect...)` | `layer(Tag, (a, b) => value, [A, B])` |
| `module({ entries })` + `buildGraph(entries)` | `module({ provide })`, `snapshot(module)` |
| `action(Effect.gen(...))` | `action((a, b) => async (...args) => ..., [A, B])` |
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
