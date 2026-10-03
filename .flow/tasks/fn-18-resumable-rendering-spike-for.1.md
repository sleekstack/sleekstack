---
satisfies: [R1]
---
# fn-18-resumable-rendering-spike-for.1 ui: Handler, on, bind, Bind node and server render with manifest

Touches: [packages/ui/package.json, packages/ui/src/node.ts, packages/ui/src/handler.ts, packages/ui/src/string.ts, packages/ui/src/dom.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/**, pnpm-lock.yaml]

## Description
Add the server half of the resumable model to `@sleekstack/ui` (R1): handler values, `on`, `bind`, the `Bind` node, and `renderToString` emitting handler, flag and bind attributes plus one escaped manifest script. `mount` renders `Bind` as static text and ignores `on` (spec Architecture, API Contracts).

**Size:** M
**Files:** `packages/ui/src/handler.ts` (new: `defineHandler`, `on`, `bind`, tagged errors), `packages/ui/src/node.ts`, `packages/ui/src/string.ts`, `packages/ui/src/dom.ts`, `packages/ui/src/index.ts`, `packages/ui/package.json` (add `@sleekstack/core` workspace dep), `packages/ui/src/__tests__/handler.test.ts` (new).
**Touches:** [packages/ui/package.json, packages/ui/src/node.ts, packages/ui/src/handler.ts, packages/ui/src/string.ts, packages/ui/src/dom.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/**, pnpm-lock.yaml]

### Approach
- Extend the `Node` union at `packages/ui/src/node.ts:3-22` with an optional `on` field on `ElementNode` and a `Bind` variant; builders go next to `el` (`node.ts:27`). The new variant breaks the exhaustive switches in `string.ts:27-48` and `dom.ts:41-75`; give both a case (`dom.ts` renders the bound atom's current value as static text, ignores `on`).
- `renderToString` (`string.ts:51-54`) gets a per-render collector: bind keys (duplicate key across different atoms fails), handler ids (two different `Handler` values with one id fail), event types, atom values. Emit attributes in the Element case (`string.ts:33-39`); keep `checkAttr` (`string.ts:17-25`) rejecting `on*` and also reject user `data-sleek-*` attrs. Never write handler attributes into `node.attrs`.
- Manifest uses its own JSON-in-script escaper (HTML `escape` at `string.ts:7-8` is not enough: also U+2028/2029). Shape `{ v, events, atoms }`; JSON codec for the spike, fn-17's Schema codec only if it has landed.
- `on()` rejects non-bubbling events (`focus`, `blur`, `mouseenter`, `mouseleave`, `load`, `scroll`) with `UnsupportedEvent`.
- Errors are tagged (`Data.TaggedError`), thrown/rejected as `renderToString` rejections following `reportRenderError`/`runToNode` in `component.ts:31-62`.
- Add the `@sleekstack/core` dependency (packages export source, no tsconfig refs; see `packages/core/package.json`). Keep `node.ts` React imports type-only so the client entry in task 2 stays React-free.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/node.ts:3-35` — Node union and builders
- `packages/ui/src/string.ts:7-54` — escape, checkAttr, serialize, renderToString
- `packages/ui/src/dom.ts:41-75` — build switch to extend
- `packages/core/src/atom/AtomStore.ts:28-72` — get/set/subscribe and `makeAtomStore`

**Optional** (reference as needed):
- `packages/ui/src/__tests__/dom.test.ts` — jsdom test pattern (`// @vitest-environment jsdom` pragma)
- `packages/islands/src/Island.tsx:73` — registry naming to mirror

### Key context
Memory: server and client must nest providers the same way, or the two outputs drift apart.

### Acceptance
- [ ] `renderToString` output for a tree with handlers, flags and binds matches R1, including the escaped manifest; `on*` still rejected
- [ ] `DuplicateHandler`, `DuplicateBindKey`, `UnsupportedEvent` and user `data-sleek-*` attrs each rejected with a test; a manifest value containing `</script>`, U+2028 and U+2029 stays inert (test)
- [ ] `mount` renders `Bind` as static text and ignores `on` (test); existing ui tests pass
- [ ] `pnpm --filter @sleekstack/ui test` and typecheck pass

## Acceptance
- [ ] TBD

## Done summary
Added `defineHandler`/`on`/`bind`, the `Bind` node, and `renderToString` output with `data-sleek-on/pd/sp-<event>`, `<sleek-bind data-sleek-bind>` and one escaped manifest script `{v:1, events, atoms}`; `mount` renders Bind as static text and ignores `on`. Review fixes: bubbling-event allowlist, attribute-safe id/key grammar, fn-17 Schema codec for serializable atoms (result atoms rejected), guest markup containing `data-sleek-` rejected (inert guests).

Drift: `@sleekstack/core` dep already present (no package.json/lockfile change); `renderToString` already owns a Store (fn-19), Bind reads from it. Bind wraps text in `<sleek-bind>` since text nodes cannot carry attributes — task 2 should subscribe that element's text.
Tests: packages/ui/src/__tests__/handler.test.ts (all R1 error cases).
Tier: opus at medium

stage: impl-review - ran (codex: fan-out NEEDS_WORK -> NEEDS_WORK -> SHIP)
## Evidence
- Commits: 871724b7ee64680a87d64af545bfcb5bf7c9e16d, ba0560b8d649ebd758a18e192cd5f58d9e295cb9, 45d9aaef0ac2c470798bcf4ce8d112abb6fa604e
- Tests: pnpm typecheck && pnpm test, pnpm --filter @sleekstack/ui test
- PRs: