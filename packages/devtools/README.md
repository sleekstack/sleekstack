# @sleekstack/devtools

Dev-only panels, built as `@sleekstack/ui` components (`@sleekstack/ui` is a peer dependency; ui never depends on
devtools).

## Runtime panel

`<SleekStackDevtools />` polls the feed handler from `@sleekstack/runtime/devtools` and shows every graph root with its
kind, live scopes, per-service acquire/release, the scope client's queries, read-only atom values and the last errors
with the scope each ran in. It renders an empty state when the handler is off (404 in production, 403 or unreachable).

Serve the handler at `/api/devtools` (the panel's default `endpoint`). It answers only loopback requests unless you
pass `allowRemote`, and a `Request` does not carry the peer, so the server passes the peer address itself:

```ts
import { devtoolsHandler } from '@sleekstack/runtime/devtools'

const devtools = devtoolsHandler({ graph: () => report })
Bun.serve({
  fetch: (request, server) =>
    new URL(request.url).pathname === '/api/devtools'
      ? devtools(request, { remoteAddress: server.requestIP(request)?.address })
      : app(request),
})
// Node: devtools(request, { remoteAddress: req.socket.remoteAddress })
```

The panel lists the atoms of every open store a `uiTrace()` observed (pass the trace as `trace`), plus any atoms you
pass as `atoms`, read from the panel's own store. A prop atom that also sits in the panel's own store is listed once,
under its prop label.

```tsx
const trace = uiTrace()
await mount(app, { layer, container, store, observe: trace.observer(store) })
// dev only, behind a dynamic import
const { SleekStackDevtools } = await import('@sleekstack/devtools')
await mount(<SleekStackDevtools trace={trace} atoms={{ demoToggles }} />, { layer, container: panelHost, store })
```

Mount it behind `process.env.NODE_ENV !== 'production'` with a dynamic `import()` so production client chunks never
contain it. The panel's markup carries `DEVTOOLS_MARKER` (and the Queries tab `QUERY_DEVTOOLS_MARKER`), and this
package's bundle test checks that both are absent from a production build.

## `@sleekstack/ui` mounts

`uiTrace()` records the render events of `@sleekstack/ui` mounts. `<UiPanel>` shows, per mount, the instance tree with
keys and slots, the atoms each instance owns with current values (from the store each mount's observer was given), why
instances re-ran and when their effects started, restarted or cleaned up.

```tsx
const trace = uiTrace()
await mount(app, { layer, container, store, observe: trace.observer(store) })
// dev only: the panel is a ui component, mounted like any other
await mount(<UiPanel trace={trace} />, { layer: Layer.empty, container: panelHost })
```

Demo: the ui panel opens below [`apps/showcase`](../../apps/showcase/README.md) in development; its Devtools page links it.
