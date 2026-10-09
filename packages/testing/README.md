# @sleekstack/testing

Component tests for `@sleekstack/ui` under Vitest and jsdom. Queries and events come from Testing Library.

| Export | Purpose |
| --- | --- |
| `render(app, { layer, hydrate?, store?, onError? })` | Mounts `app` (or, with `hydrate`, hydrates that server HTML) inside `act` into a `div` on `document.body`; resolves to `Rendered` |
| `Rendered` | `{ container, dispose() }`; `dispose` unmounts and removes the container. Every live render is disposed after each test |
| `flush(options?)` | Ticks inside `act` until `quietTicks` (3) consecutive `tickMs` (5 ms) ticks leave the DOM unchanged: re-runs, post-commit effects and the short timers they schedule have run |
| `FlushTimeout` | `flush` saw no quiet window within `maxRounds` (50) ticks |
| `mockLayer(Tag, partial)` | A Layer for `Tag` from a partial implementation; calling a missing method is a defect naming `Tag.method` |

Setup: `environment: 'jsdom'` and `globals: true` in the Vitest config (the automatic disposal registers on the global `afterEach`). Install `@testing-library/dom` and `@testing-library/user-event` in the app and query `within(container)` or `screen`.

```ts
const { container } = await render(jsx(Counter, {}), { layer: Layer.empty })
await userEvent.click(within(container).getByRole('button'))
await flush()
```

Streamed HTML: run its inline scripts first (as a browser would), then pass the result as `hydrate`. Refs: a `useRef` passed as a host `ref` holds the element after `render` and `null` after `dispose`.

Limit: `flush` judges settledness by the DOM. Work that waits longer than the quiet window (a long `Effect.sleep`, a slow request) is not awaited; use Testing Library's `findBy*` / `waitFor`. Design: ADR 0031.
