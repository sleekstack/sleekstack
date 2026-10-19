---
satisfies: [R1, R2, R3]
---
# fn-63-textarea-value-renders-as-content-on.1 ui: textarea value as server content, hydration adopts it

Touches: packages/ui/src/string.ts, packages/ui/src/hydrate.ts, packages/ui/src/__tests__/string.test.ts, packages/ui/src/__tests__/hydrate.test.ts, packages/ui/src/__tests__/stream.test.ts, docs/adr/0021-atoms-bind-in-jsx.md

## Description
Server-render a textarea's `value` (static or atom-bound) as escaped content instead of an attribute, make `value` plus children an error, and make hydration leave a textarea's DOM text and live value alone so no mismatch is reported.

**Size:** M
**Files:** `packages/ui/src/string.ts`, `packages/ui/src/hydrate.ts`, `packages/ui/src/__tests__/{string,hydrate,stream}.test.ts`, `docs/adr/0021-atoms-bind-in-jsx.md` (amend; or a new ADR plus its `docs/adr/README.md` row)

### Approach
- `string.ts` `Element` case (~146-153 / serialize near line 198): attrs come from `node.attrs` (static `value` is already a string; nullish and `false` are dropped, `true` is empty, by `jsx-runtime.ts` ~60 and ~120-128) and `boundAttrs(node, c)` (~112-119, reads the atom with `c.store.get`, drops nullish and `false`). For `node.tag === 'textarea'`, exclude `value` from both and write it as `escape(text)` content; a value starting with `\n` or `\r` gets one extra leading `\n`. A textarea with both `value` and children throws `TypeError` like the void-element-with-children check. Do not change `input` or `select`.
- Stream (`stream.ts` 186, 208, 231) and resume (`resume.ts:99`) call the same serializer or read the live value: no change expected; add a streamed-Pending textarea test.
- `hydrate.ts` `Element` adopt case (~176-182): `adoptAll(n.children, ...)` (289-332) would report the server text as an extra node. For a `textarea`, skip child adoption, leave the DOM text and `.value` as the server or user left them, and still call `wire(el, n, env, true)` so atom-bound `value` subscribes without a first write (`bindAttrs` `adopt=true`, `dom.ts:412-414`). Do not change client mount (`dom.ts` 383-400, 545-546).
- Amend ADR 0021 line 14 ("`renderToString` writes the current value as a plain attribute") with the textarea exception.

### Investigation targets
**Required**:
- `packages/ui/src/string.ts:100-215`, `packages/ui/src/hydrate.ts:170-190,285-335`
- `packages/ui/src/dom.ts:383-414,545-546`, `packages/ui/src/jsx-runtime.ts:55-130`
- `packages/ui/src/__tests__/hydrate.test.ts:340-353` (typed-value template), `packages/ui/src/__tests__/string.test.ts:60`
- `docs/adr/0021-atoms-bind-in-jsx.md`

### Acceptance
- [ ] String tests: `value="a<b&c"` gives `<textarea>a&lt;b&amp;c</textarea>` with no attribute; `</textarea>` and quotes escaped; number and `0`; nullish, `false`, `true`, `""` empty; atom-bound string, number, nullish; value plus children throws `TypeError`; `input` and `select` byte-identical
- [ ] Round trip through a real DOM parser (jsdom) for values `""`, `"\n"`, `"\nx"`, `"\r\nx"`, `"a\n"` equals the original `.value`
- [ ] Hydrate tests: static and atom-bound textarea hydrate with no mismatch report and no removed node; text typed before hydrate survives; a later atom change updates the control
- [ ] Stream test: a textarea in a Pending boundary with a leading newline round-trips; existing stream, resume and hydrate tests unchanged
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase` green (size test included)

## Acceptance
- [ ] TBD

## Done summary
`renderToString` (and so stream and Pending output) now writes a textarea's static or atom-bound `value` as escaped content, never an attribute, with one extra leading newline when the value starts with a line break; `value` plus children is a `TypeError`. Hydration skips child adoption for a value-only textarea, so the server text and typed value survive with no mismatch while the atom still subscribes without a first write. ADR 0021 amended.

Tests: string.test.ts (static/atom values, escaping, number/0, nullish/false/true/"" empty, value+children TypeError, input/select unchanged), hydrate.test.ts (jsdom parser round trip for "", "\n", "\nx", "\r\nx", "\rx", "a\n"; static + atom-bound adopt with no mismatch, no removed node, typed text kept, later atom change applied), stream.test.ts (Pending-streamed textarea with a leading newline). Each new test was confirmed red against the old code.

Gates: `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase --filter=!realworld` green (13/13, showcase size test included). The spec Quick command with `--filter=realworld` is red on realworld#test: 3 editor tests hit the new value-plus-children TypeError because apps/realworld editor.tsx/settings.tsx still pass both (the workaround task .2 removes; apps/realworld is outside this task's Touches). Task .2 must land before the spec gate goes green.

stage: impl-review - ran (codex fan-out, 3 draws SHIP, rid 3a5d70b1249344b284536c69c9eaa683)
Tier: session (jev-unavailable(no_key)); actual model: claude-opus-5-5
## Evidence
- Commits: 87fde24430d385ec51a2fa83663628868b499031
- Tests: baseline: green (pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase --filter=realworld), pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase --filter=!realworld (green), pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase --filter=realworld (red: realworld#test, 3 editor tests, value+children TypeError until task .2)
- PRs: