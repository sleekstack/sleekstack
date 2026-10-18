# 0042. `@sleekstack/ui`: void elements without closing tags, and `Head`

## Status

Accepted. Built in spec fn-59 (tasks 1 and 2). Delivers the head management of fn-33.

## Context

`renderToString` wrote `<meta ... ></meta>` for void elements, which browsers parse as a stray close tag, and pages had no way to set `title`, `meta` and `link`.

## Decision

**Void elements.** `br`, `hr`, `img`, `input`, `meta`, `link` and the other HTML void tags serialize without a closing tag. The list is one regex, not a Set, to stay inside the size caps. `RunFrame` gained `depth`, which `Head` uses to rank nesting.

**`Head`.** `<Head>` takes `title`, `meta` and `link` elements with plain attributes; anything else is a `TypeError`, and attributes go through the same `checkAttr` as elements. Tags dedupe by key (`title`, `meta[name]`, `meta[property]`, `link[rel]+href`); the deepest `Head` wins; a component's tags go when it unmounts. The collector is the `HeadSink` `Context.Reference` (`Collector` already means two things).

- **`renderToString`** hands the resolved tags to its `onHead` option; the caller writes them into its `<head>`.
- **`mount`** patches the global `document.head`. This is a deliberate shortcut: a mount into an iframe still patches the parent document. A per-mount head target waits for a user who needs it.
- **`renderToStream`** passes the shell's tags to `onHead` once, before the first chunk. After that, a tag a resolved `Pending` boundary adds or changes is patched into `document.head` by an inline script (`__sleekHead`, with the stream nonce) ahead of that boundary's swap. The patch covers keyed `meta` only (`name`, `property`, `http-equiv`, `charset`); a tag that goes away stays, since the shell has already flushed.
- **Hydration** adopts the server's head tags by key instead of duplicating them.

Open Graph tags use `property`, so they dedupe like any `meta[property]`.

## Rejected

- **Managing `html` and `body` attributes:** out of scope (fn-33 Boundaries).
- **Removing tags in a stream patch:** the shell's tags are already in the document; removal would need a tombstone protocol for no known user.

## Consequences

The size cost is in ADR 0022: 40 to 55 B of headroom is left in the `mount`, `hydrate` and `lazy` entries. The stream protocol (ADR 0023) gains one inline function and one script per boundary that changes the head.
