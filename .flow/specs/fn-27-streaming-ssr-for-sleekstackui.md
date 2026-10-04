## Goal & Context
<!-- scope: business -->

`renderToString` waits for the whole tree. With `Pending` and hydration in place, streaming SSR sends the shell first and fills pending boundaries as they resolve, improving time to first byte.

## Architecture & Data Models
<!-- scope: technical -->

- `renderToStream(node)` returns a Web `ReadableStream<string>` (stdlib; no Node-only API).
- Shell renders with each unresolved `Pending` boundary emitted as a placeholder with an id; when it resolves, a chunk carries the HTML and a tiny inline swap script.
- Hydration (previous spec) must accept out-of-order boundaries: a boundary resolved after hydration starts hydrates when its content arrives (open question: mismatch handling during the gap; decide in task 1).
- Errors before the shell flush produce a real error response path; after flush, the boundary's error fallback is streamed.
- Store snapshot is appended after the last chunk or per boundary (open question).

## API Contracts
<!-- scope: technical -->

`renderToStream(node, options?): ReadableStream<string>`; `renderToString` unchanged.

## Edge Cases & Constraints
<!-- scope: technical -->

Client abort cancels pending fibers; nested boundaries resolve inner-first or outer-first consistently; duplicate ids impossible across multiple streams on one page; CSP-safe script option.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The first chunk contains the shell and fallbacks without waiting for any pending boundary.
- **R2:** Resolved boundaries stream in completion order and the final DOM equals `renderToString` output after the swap runs in jsdom.
- **R3:** A client that hydrates mid-stream ends in the same DOM as a fully-loaded hydrate.
- **R4:** Cancelling the stream interrupts pending fibers and closes scopes.
- **R5:** An error inside a boundary after flush renders its fallback; an error before flush rejects.
- **R6:** ADR records the protocol; README documents it.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui...`

## Boundaries
<!-- scope: business -->

No framework server integration (that is the router/Vite specs); no resume.

## Decision Context
<!-- scope: both -->

Depends on Pending and hydration; deliberately after the built package so the output format is stable.
