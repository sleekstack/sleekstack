## Goal & Context
<!-- scope: business -->

`renderToString` waits for the whole tree. With `Pending` (fn-24) and hydration (fn-25), streaming SSR sends the shell first and fills pending boundaries as they resolve.

## Architecture & Data Models
<!-- scope: technical -->

- `renderToStream(node, options?)` returns a Web `ReadableStream<Uint8Array>` (usable directly in `new Response`); built on stdlib only.
- The shell renders each unresolved `Pending` boundary as a placeholder carrying a unique id, using the `{ fallback, content }` shape fn-24 exposes. Each resolved boundary streams a chunk with its HTML and a small swap script. Script nonce comes from `options.nonce`.
- **Per-boundary state.** Each boundary's chunk carries its own dehydrated atom and query state (fn-25 format) so the client `Pending` does not rerun its content or refetch. The resume manifest, if used, is emitted once after the last chunk.
- **Hydration of late boundaries.** fn-25's hook: hydration skips boundaries whose content has not arrived and adopts each one when its chunk lands; the final DOM equals a fully-loaded hydrate.
- Errors before the shell flushes reject the stream with the typed error; errors after flush stream that boundary's error fallback.
- Ids are unique across several streams on one page (id prefix option).

## API Contracts
<!-- scope: technical -->

`renderToStream(node, options?: { nonce?: string; idPrefix?: string; onError? }): ReadableStream<Uint8Array>`; `renderToString` unchanged.

## Edge Cases & Constraints
<!-- scope: technical -->

Client abort cancels pending fibers; nested boundaries resolve in completion order and an inner boundary's chunk waits for its parent's placeholder; no inline script when `nonce` forbids it is not supported (documented).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The first chunk contains the shell and fallbacks without waiting for any pending boundary. Errors: a render defect before flush rejects.
- **R2:** Resolved boundaries stream in completion order, and after the swap runs in jsdom the DOM equals `renderToString` output once placeholder ids and swap scripts are normalised out. Errors: a boundary failing after flush streams its fallback.
- **R3:** A client that hydrates mid-stream ends in the same DOM as a fully loaded hydrate, with no refetch for boundary state. Errors: a missing boundary chunk leaves the fallback and reports.
- **R4:** Cancelling the stream interrupts pending fibers and closes scopes, retain counts back to zero. Errors: none.
- **R5:** `nonce` appears on every inline script; two streams on one page do not collide ids.
- **R6:** ADR records the protocol; README documents it.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui...`

## Boundaries
<!-- scope: business -->

No framework server integration (router and Vite specs), no resume work.

## Decision Context
<!-- scope: both -->

Depends on fn-24, fn-25 and fn-26 (stable output).


## Planning decisions
<!-- scope: technical -->

- Signature is `renderToStream(app, { layer, nonce, idPrefix, onError })`, mirroring `renderToString`'s `layer` option.
- The stream emits no resume manifest. One Collector spans the stream; each chunk carries only the state changed since the previous chunk.
- The store, scopes and fibers live until the last boundary resolves and are disposed on completion, error or cancel.
- Chunk HTML sits in a template container; the swap runtime is emitted once in the shell; every inline script carries the nonce. A stream-end marker lets the client report unresolved placeholders.
- Post-flush errors stream the nearest Boundary fallback, else keep the Pending fallback and report to `onError`.
- fn-27 owns the late-boundary adoption hook that fn-25 leaves as a seam.


## Early proof point

Task fn-27-streaming-ssr-for-sleekstackui.1 validates the core approach (shell-first streaming with one swapped boundary equals renderToString). If it fails, re-evaluate the chunk protocol and store lifetime before fn-27.2+

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | The first chunk contains the shell and fallbacks without waiting for any pending boundary. Errors: a render defect before flush rejects. | fn-27-streaming-ssr-for-sleekstackui.1 | — |
| R2 | Resolved boundaries stream in completion order, and after the swap runs in jsdom the DOM equals `renderToString` output once placeholder ids and swap scripts are normalised out. Errors: a boundary failing after flush streams its fallback. | fn-27-streaming-ssr-for-sleekstackui.2, fn-27-streaming-ssr-for-sleekstackui.3 | — |
| R3 | A client that hydrates mid-stream ends in the same DOM as a fully loaded hydrate, with no refetch for boundary state. Errors: a missing boundary chunk leaves the fallback and reports. | fn-27-streaming-ssr-for-sleekstackui.4, fn-27-streaming-ssr-for-sleekstackui.5 | — |
| R4 | Cancelling the stream interrupts pending fibers and closes scopes, retain counts back to zero. Errors: none. | fn-27-streaming-ssr-for-sleekstackui.3 | — |
| R5 | `nonce` appears on every inline script; two streams on one page do not collide ids. | fn-27-streaming-ssr-for-sleekstackui.2, fn-27-streaming-ssr-for-sleekstackui.6 | — |
| R6 | ADR records the protocol; README documents it. | fn-27-streaming-ssr-for-sleekstackui.6 | — |

