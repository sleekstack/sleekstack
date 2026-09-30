# `@sleekstack/next` exposes an internal Exit hook for adapters

> Superseded by [ADR 0012](0012-next-runtime-management-sugar-in-kit.md): next no longer has `action`/`query`, so the hook is gone.

`action`/`query` in `@sleekstack/next` take an `@internal` `onExit` option. After the request scope closes, the hook receives the operation's `Exit`; its return value resolves the call and a throw rejects it. kit's `next` lowering uses it to map one Exit to an `ActionResult`, a `HandlerFailed` rejection, or a query rejection, instead of encoding failures as `FAILED`/`ERRORED` sentinel symbols in the success value.

## Considered options

- **Sentinel symbols in the success value**: rejected. Failures travel as data, so the outer wrapper has to decode every result, and the encoding is a second protocol beside Effect's own Exit.
- **Unwrap next's rejection (`Error` with a `Cause` as `cause`)**: rejected. It cannot tell next's envelope from a user-thrown `Error` that happens to carry a Cause.
- **An internal Exit hook** *(chosen)*: the adapter sees the typed failure directly. The stream guard and request-scope close are unchanged, and the default settle (resolve the value, reject with `Error(pretty, { cause })`) is unchanged for public callers.

## Consequences

- User return values can no longer collide with an internal encoding.
- kit `normalize` no longer unwraps a plain `Error` whose `cause` is a Cause; a user-thrown one becomes `HandlerFailed`.
- The hook is not public API and is excluded from the reference; it may change without a major version.
