# 0044. `renderToStream` head: shell tags, then late patches for `title` and keyed `meta`

## Status

Accepted. Built in spec fn-33 (task 3).

## Context

`Head` collects `title`, `meta` and `link` tags. `renderToString` hands the deduped markup to `onHead` after the whole tree resolved. A stream flushes its shell before its `Pending` boundaries resolve, so a `Head` inside a boundary, or in its fallback, changes the head after the caller has already written it.

## Decision

- **Shell.** `renderToStream` calls `onHead` once, before the first chunk, with the shell's head markup. The dedupe and markup are the ones `renderToString` uses, so the same tree gives the same head. Heads in an unresolved boundary's fallback count, since the fallback is what the shell shows.
- **Late changes.** When `onHead` is set and a boundary resolves, its fallback's tags leave the head and its content's tags join it. Each key whose winner changed is patched by `__sleekHead(...)` in the boundary's swap script, which carries the stream nonce like every other inline script. The patch sets the key's element (created if missing) to the winner's attributes and text, or removes it when no `Head` holds the key any more.
- **Patchable keys:** `title` and keyed `meta` (`meta[name]`, `meta[property]`). `link` and unkeyed tags (`meta charset`, a `link` without `rel` and `href`) are shell-only: a late one is ignored, and a shell one is never removed. The choice is deterministic, never an error.
- **Errors.** An invalid head tag in the shell rejects the stream like an invalid element. One in late content reports to `onError` and leaves that boundary on its fallback, as any serialize error after flush does.

## Rejected

- **Shell-only for every tag:** a page's title usually depends on the data a boundary waits for, so the title would stay on the fallback's value.
- **Patching `link`:** a stylesheet or preload added after flush loads late and can flash unstyled content, and removing one the shell loaded would unstyle the page. Links belong in the shell.
- **Patching unkeyed tags:** with no key there is nothing to replace, so each late chunk could only append another copy.

## Consequences

- A page that wants a late title or description writes the `onHead` markup into its `<head>` before piping the stream; without `onHead` no patch is emitted.
- Hydration (task 4) adopts the head as patched, by key.
