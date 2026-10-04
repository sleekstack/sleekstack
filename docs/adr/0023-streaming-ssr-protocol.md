# 0023: Streaming SSR protocol for `@sleekstack/ui`

**Status:** Accepted

`renderToStream(app, { layer, nonce, idPrefix, onError })` (fn-27) streams a host tree as HTML. `renderToString` is unchanged and still awaits every `Pending`. This ADR fixes the wire protocol between the stream and the client, since the shell's inline runtime, the hydrate walk (`hydrateMount`) and any later adapter all depend on it.

## Decision

**Shell.** The first chunk is the whole tree with each unresolved `Pending` rendered as its fallback between a comment pair: `<!--sleek-p:ID-->fallback<!--/sleek-p-->`. When the tree has at least one boundary, the shell starts with one inline script that defines `self.__sleekSwap` and `self.__sleekEnd`. A tree with no unresolved `Pending` streams exactly the `renderToString` output, with no runtime. A failure before the shell flushes errors the stream with the original failure or defect.

**Ids.** A boundary id is `<idPrefix><n>`. `idPrefix` defaults to `sleek-` and must match the handler-id pattern (else `TypeError`).

**Chunks.** When a boundary resolves, the stream emits `<template data-sleek-b="ID">html</template>` followed by `<script>__sleekSwap("ID")</script>`. The swap finds the `sleek-p:ID` comment, removes everything up to its matching `/sleek-p` (depth-counted, so nested boundaries work), and puts the template content in its place. Nested boundaries flush after their parent.

**Hydrate payload.** The shell carries the `data-sleek-hydrate` JSON script (ADR 0016). For a stream only, it has a `b` map from boundary id to path. A path numbers `Pending`s per enclosing boundary in run order (`0`, `1`, `1.0`), so the client can match a placeholder still on screen to its `Pending`. Each chunk carries its own payload for the atoms and queries it rendered.

**Swap wrapper.** `hydrateMount` wraps `self.__sleekSwap`: a chunk that lands after the hydrate walk runs the stock swap, seeds that chunk's payload, runs the boundary content with hydration on, and adopts the swapped nodes in place of the fallback's lives. Landings run one at a time. A chunk for a boundary already adopted is ignored.

**End marker.** When the stream finishes with boundaries that never got a chunk (their content failed with no matching `Boundary`, or was cancelled), it emits `__sleekEnd([ids])`. The runtime appends those ids to `self.__sleekGone`, so a client that hydrates after the stream ended still sees them. The client reports each one as `BoundaryChunkMissing` to `onError` and keeps the fallback.

**Nonce.** Every inline script the stream emits carries `nonce` when given: the runtime, each swap call, the end marker and the JSON payload scripts.

**Lifetime.** The layer is built in the stream's root scope. The store, slots and scope are disposed when the stream completes, errors or is cancelled. There is no resume manifest: a streamed page hydrates; it does not `resume` (ADR 0017).

**Several streams on one page.** `__sleekSwap` and `__sleekEnd` are page-global. Each shell redefines them, so a later shell replaces the earlier runtime (and any `hydrateMount` wrapper installed on it). The runtime is identical across streams and keyed only by id, so swaps still work, provided each stream on the page has a distinct `idPrefix`. Hydrating more than one stream per page is not supported.

## Consequences

- Placeholders are comments, so the shell parses as normal HTML and needs no wrapper element around a fallback.
- The protocol relies on inline scripts. A strict CSP needs `nonce`.
- Matching by path relies on preorder runs of the tree.
- An atom already built on the client keeps its first value; a later chunk seeds only new atoms.
- Tests: `packages/ui/src/__tests__/stream.test.ts`, `apps/ui-demo/test/stream.test.ts` (two streams, distinct `idPrefix`).
