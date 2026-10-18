## Goal & Context
<!-- scope: business -->

Delivered by fn-59 (ADR 0042). `<Head>` sets `title`, `meta` and `link` in the DOM (`mount` patches the global `document.head`), in `renderToString` (through `onHead`) and in `renderToStream` (shell tags through `onHead`, later boundaries through an inline `__sleekHead` script with the nonce). Hydration adopts server head tags. Tags dedupe by key, the deepest `Head` wins, and tags go when their component unmounts.

Nothing is left except two known limits recorded in ADR 0042: a stream patch covers keyed `meta` only (a removed tag stays), and a mount into an iframe still patches the parent document.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Delivered. Invalid tags and attributes are rejected like elements.
- **R2:** Delivered. Dedupe by key and removal on unmount.
- **R3:** Delivered. The stream policy is the patch script above.
- **R4:** Delivered. Hydration adopts server tags without duplicates.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui...`

## Boundaries
<!-- scope: business -->

No analytics, no document-level `html` or `body` attribute management.

## Decision Context
<!-- scope: both -->

Depends on fn-25 and fn-27. Landed in fn-59 before SSG (fn-30).
