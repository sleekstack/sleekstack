## Goal & Context
<!-- scope: business -->

Head management: `<Head>` for `title`, `meta` and `link`, working in the DOM renderer, `renderToString` and streaming. Split from the original productize spec.

## Architecture & Data Models
<!-- scope: technical -->

- A per-render head collector provided through a `Context.Reference` (a new name: `Collector` already means two things, `reactive.ts` and `string.ts`; call it `HeadSink`).
- DOM mode patches `document.head` through a reconciler-like keyed patch; entries dedupe by key (`title`, `meta[name]`, `meta[property]`, `link[rel]+href`); the deepest component wins; tags are removed when their component unmounts.
- SSR puts head tags in the shell. **Streaming:** a title or meta that changes after the shell has flushed is emitted as an inline patch script (with the stream nonce) or, per tag, marked shell-only; task 1 picks and documents. `Head` inside a `Pending` subtree resolves with the boundary.
- Hydration adopts server head tags.

## API Contracts
<!-- scope: technical -->

`<Head>` component; `renderToString`/`renderToStream` return or expose the head string through `options`.

## Edge Cases & Constraints
<!-- scope: technical -->

Conflicting titles; `Head` in a keyed list; head tags with attributes needing the same `checkAttr` validation as elements.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `Head` sets title and meta in the DOM, in `renderToString` and in `renderToStream` output; nested overrides win. Errors: an invalid tag or attribute is rejected like an element and reported.
- **R2:** Entries dedupe by key and are removed when their component unmounts.
- **R3:** A head change after the stream shell flushed follows the documented policy in a test.
- **R4:** Hydration adopts server head tags without duplicating them.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui...`

## Boundaries
<!-- scope: business -->

No analytics, no document-level `html`/`body` attribute management.

## Decision Context
<!-- scope: both -->

Depends on fn-25 and fn-27. Must land before SSG (fn-30).
