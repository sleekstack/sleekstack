# 0021. An atom in JSX binds the DOM directly

## Status

Accepted (prototype). Extends ADR 0016 (serializable atoms, `bind`).

## Context

A component that reads an atom (`yield* useAtomValue(a)`) re-runs whenever `a` changes, even when the value only lands in one text node or one attribute. Only serializable value atoms could be used as a JSX child (`bind`), and they were bound for resume.

## Decision

- **Child.** Any atom as a JSX child (`<p>{label}</p>`, including a derived atom `Atom.make((get) => ...)`) renders its current value as text and follows the atom. A serializable value atom stays a resumable `bind`; any other atom is a `Bind` node with `plain: true`: live on the client, plain escaped text in `renderToString`, never resumed.
- **Attribute.** An atom as the value of a prop other than `children`, `key` or an `on*` event becomes `ElementNode.bound[name]`. The renderer sets the attribute from the atom, subscribes, and updates the attribute on change. Nullish and `false` remove it, `true` sets it empty; form `value`/`checked` also set the property. `renderToString` writes the current value as a plain attribute (not resumed), except a `textarea`'s `value` (amended by fn-63).
- **Textarea value (amendment, fn-63).** A browser ignores a `value` attribute on a `textarea`, so the server writes a textarea's `value` (static or atom-bound) as its escaped text content, with one extra leading newline when the value starts with a line break (the parser drops one). Nullish, `false` and `true` render empty. A `textarea` with both `value` and children is a `TypeError`. Hydration leaves that text and the live value alone and subscribes the atom without a first write, so text typed before hydration survives. Client mount still assigns the `value` property, so only a server-rendered textarea has the text as its `defaultValue` (seen by `form.reset()`). `input` and `select` are unchanged.
- The enclosing component does not re-run, and the renderer retains each atom while its element is live. A parent re-run that passes a different atom re-points the binding on commit; dropping the element releases it.
- An element with bound attributes or atom children is not a host-only row (ADR 0020 fast path), so such a row takes the normal run.

## Consequences

- No syntax change: passing an atom where a value goes is the opt-in. Components that read the value with `useAtomValue` behave as before.
- Measured (`render-dom/atom-bound-text-1k`: one derived atom shown in 1,000 `<li>`s, one write): about 0.38ms against React about 3.8ms (jsdom, same process).
- A derived atom computes in the store, so formatting belongs in `Atom.make((get) => ...)`, not in the component.
- Not covered: resuming plain binds or bound attributes (they need a serializable key), and an atom as a style or object prop.
