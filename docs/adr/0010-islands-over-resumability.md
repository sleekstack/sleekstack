# Islands over resumability

`@sleekstack/islands` defers hydration per Island instead of making React resumable. Each Island is server-rendered in full, keeps its server DOM behind an empty `suppressHydrationWarning` container, and on its trigger downloads its chunk and calls `hydrateRoot` on that container as its own React root.

## Considered options

- **Qwik-style resumability** (serialised closures, no hydration): rejected. It cannot run arbitrary React components or libraries, and React compatibility is the hard requirement.
- **A compiler that extracts Islands automatically**: rejected as overkill. An explicit `defineIslands` registry is smaller and works today.
- **Deferred hydration of per-Island roots** *(chosen)*: a hydrated Island still renders once, but an Island that is never triggered costs no download and no execution beyond the wrapper.

## Consequences

- One React root per Island costs memory, and roots share no React context. The kit app scope therefore lives outside React: `LayerProvider` gained an additive option to adopt an externally owned app scope without closing it. On the client it is shared by a registry's Islands on the page and reference-counted; on the server it is one process-lifetime scope per registry.
- Kit atoms live in the component scope, so they are per Island in v1.
- React only replays events for roots it is already hydrating, so Islands replay the first pre-hydration click themselves. Targets whose native default already ran (links, checkbox, radio, labels, submit buttons, `summary`) are not replayed.
- `useId` can mismatch, Next router context is absent inside Islands, and Island modules have no HMR in v1.
