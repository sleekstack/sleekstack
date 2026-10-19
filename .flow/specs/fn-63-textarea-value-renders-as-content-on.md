## Goal & Context
<!-- scope: business -->

A `<textarea value={...}>` shows nothing when server-rendered. The string renderer writes `value` as an attribute (`<textarea value="...">`), which a browser ignores on a textarea; the text only appears after client code assigns the `value` property. A page that edits existing text (the RealWorld settings bio and editor body) has to render the text a second time as children to work around it. After this spec a `value` on a textarea renders as the textarea's content on the server and survives hydration, with no workaround in app code.

## Architecture & Data Models
<!-- scope: technical -->

- **One change point on the server.** String, stream, Pending-boundary and resume output all go through the same element serializer, so the `Element` case of the string renderer covers them. For `textarea` only, `value` (static in the element's attributes, or atom-bound in its bound attributes) is written as the escaped text content and is never emitted as an attribute. `input` and `select` keep `value` as an attribute.
- **Value and children together is an error** (a `TypeError` at serialization, the same class as a void element with children). "Value wins on the server only" would leave the client node tree with children the server DOM lacks.
- **Hydration needs a change.** Adoption walks the client node's children against the DOM children. A textarea built from `value` has no client children, but its server DOM now holds a text node, so adoption reports an extra node, raises a hydration mismatch and removes the text. For a textarea, adoption must leave the DOM text and the live `value` alone (as it already leaves form `value` alone) and still subscribe atom-bound attributes without writing the first value, so text the user typed before hydration survives.
- Client mount, which sets the `value` property after building children, is unchanged; the `defaultValue` difference between server-rendered and client-mounted textareas (affects `form.reset()` only) is documented, not changed.

## API Contracts
<!-- scope: technical -->

No new API; `textarea.value` keeps its type `V<string | number>`. Behavior change: renderer output and what hydration adopts. A resumed page and `resume.ts` need no change (it reads the live control value).

## Edge Cases & Constraints
<!-- scope: technical -->

- Escaping covers `<`, `&`, quotes and `</textarea>` in the value (the content is RCDATA).
- The HTML parser drops one newline right after `<textarea>` (a `\r` is normalized to `\n` first), so a value that starts with `\n` or `\r` is written with one extra leading newline to round-trip. Verify with a real parser, not string comparison.
- Static `value` is already a string in the element's attributes (nullish and `false` are dropped before serialization, `true` becomes empty), so those cases are decided before the serializer runs. For an atom: nullish and `false` render empty, `true` renders empty (as a static `true` does), a number renders as text including `0`.
- A textarea inside a streamed Pending boundary is swapped in from a `<template>`; the same leading-newline rule applies there.
- Existing hydrate, stream and resume tests stay green; showcase's size budget (ADR 0022) is checked, the serializer is outside the `mount` bundle.
- ADR 0021 states "`renderToString` writes the current value as a plain attribute": amend it (or add an ADR) for the textarea exception.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `renderToString(<textarea value="a<b&c" />)` yields `<textarea>a&lt;b&amp;c</textarea>` with no `value` attribute; values starting with `\n`, `\r\n` and `\r` round-trip through a real DOM parser to the same `.value`. Errors: nullish, `false`, `true` and `""` give an empty textarea; a number renders as text (`0` included); `value` plus children throws `TypeError`; `</textarea>` in the value stays escaped.
- **R2:** An atom-bound `value` renders its current value as content on the server and hydrates with no mismatch event and no removed node; later atom changes update the control, and text typed before hydration is not overwritten. Errors: a nullish atom value renders empty; a streamed-in textarea with a leading newline round-trips.
- **R3:** `input` and `select` output is unchanged, stream and resume output for all other elements is byte-identical, and the showcase size test passes.
- **R4:** `apps/realworld` settings (bio) and editor (body) pass `value` only, with their duplicate children and comments removed; their tests and `check` pass. Docs: a note in the ui page on textarea `value`, and the ADR 0021 amendment, with the ADR index updated if a new ADR is added.

## Early proof point
<!-- scope: technical -->

Task fn-63-textarea-value-renders-as-content-on.1 validates the core approach (server content plus a hydration that adopts it without a mismatch). If it fails, re-evaluate having the client build the text child before fn-63-textarea-value-renders-as-content-on.2.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase --filter=realworld`

## Boundaries
<!-- scope: business -->

Out of scope: `select` and `option` selected state, `input` changes, controlled-input semantics beyond what exists, `defaultValue` as a prop, changing client mount, a new form API.

## Decision Context
<!-- scope: both -->

Raised by fn-61 (RealWorld app): settings and editor render the text both as `value` and as children. Rejected "app code always passes children": the typed `value` prop exists and should work. Rejected "value wins, children dropped on the server": it makes server and client trees diverge. Not needed: new hydrate code to read `value` (adoption already skips form values); what is needed is skipping the text child.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `renderToString(<textarea value="a<b&c" />)` yields `<textarea>a&lt;b&amp;c</textarea>` with no `value` attribute; values starting with `\n`, `\r\n` and `\r` round-trip through a real DOM parser to the same `.value`. Errors: nullish, `false`, `true` and `""` give an empty textarea; a number renders as text (`0` included); `value` plus children throws `TypeError`; `</textarea>` in the value stays escaped. | fn-63-textarea-value-renders-as-content-on.1 | — |
| R2 | An atom-bound `value` renders its current value as content on the server and hydrates with no mismatch event and no removed node; later atom changes update the control, and text typed before hydration is not overwritten. Errors: a nullish atom value renders empty; a streamed-in textarea with a leading newline round-trips. | fn-63-textarea-value-renders-as-content-on.1 | — |
| R3 | `input` and `select` output is unchanged, stream and resume output for all other elements is byte-identical, and the showcase size test passes. | fn-63-textarea-value-renders-as-content-on.1 | — |
| R4 | `apps/realworld` settings (bio) and editor (body) pass `value` only, with their duplicate children and comments removed; their tests and `check` pass. Docs: a note in the ui page on textarea `value`, and the ADR 0021 amendment, with the ADR index updated if a new ADR is added. | fn-63-textarea-value-renders-as-content-on.2 | — |
