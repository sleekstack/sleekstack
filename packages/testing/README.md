# @sleekstack/testing

Component tests for `@sleekstack/ui` under Vitest and jsdom. Queries and events come from Testing Library.

| Export | Purpose |
| --- | --- |
| `render(app, { layer, hydrate?, store?, onError? })` | Mounts `app` (or, with `hydrate`, hydrates that server HTML) inside `act` into a `div` on `document.body`; resolves to `Rendered` |
| `Rendered` | `{ container, dispose() }`; `dispose` unmounts and removes the container. Every live render is disposed after each test |
| `flush(options?)` | Ticks inside `act` (`tickMs`, 10 ms) until the ui renderer has no work in flight: re-runs, post-commit effects, `Pending` content and handler fibers, their sleeps included |
| `FlushTimeout` | Renderer work was still in flight after `maxRounds` (100) ticks, such as an effect that never ends |
| `mockLayer(Tag, partial)` | A Layer for `Tag` from a partial implementation; calling a missing method is a defect naming `Tag.method` |

Setup: `environment: 'jsdom'` and `globals: true` in the Vitest config (the automatic disposal registers on the global `afterEach`). Install `@testing-library/dom` and `@testing-library/user-event` in the app and query `within(container)` or `screen`.

```ts
const { container } = await render(jsx(Counter, {}), { layer: Layer.empty })
await userEvent.click(within(container).getByRole('button'))
await flush()
```

Streamed HTML: run its inline scripts first (as a browser would), then pass the result as `hydrate`. Refs: a `useRef` passed as a host `ref` holds the element after `render` and `null` after `dispose`.

Limit: `flush` sees only renderer work. A raw `setTimeout` or a promise nothing forks is not awaited; use Testing Library's `findBy*` / `waitFor`. Design: ADR 0032.
