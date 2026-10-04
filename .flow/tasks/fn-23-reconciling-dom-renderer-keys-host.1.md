# fn-23-reconciling-dom-renderer-keys-host.1 ui: Node key/events fields, JSX event + key plumbing, string renderer ignores them

Touches: packages/ui/src/node.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/reactive.test.ts, packages/ui/src/__tests__/string.test.ts

## Description
Types and JSX plumbing only, no DOM work, so the Analyzer and DOM tasks can build on stable shapes. Branch from `origin/master` (fn-18's handler/resume files are not on `chore-close-done-specs`).

**Size:** M
**Files:** `packages/ui/src/node.ts`, `packages/ui/src/jsx-runtime.ts`, `packages/ui/src/index.ts`, tests in `packages/ui/src/__tests__/`
**Touches:** [packages/ui/src/node.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/**]

### Approach
- `node.ts`: add `EventBinding` and the optional `events` and `key` fields exactly as shown in the spec's API Contracts; add `key?` to `GuestNode` and `ReactiveNode`, and `id` (internal) to `ReactiveNode`. Omit absent optionals, never set them to `undefined` (existing `toEqual` assertions on plain nodes must keep passing).
- `jsx-runtime.ts` `attrs()` (the `RENAME` / `children` / `key` filter): divert function-valued `onXxx` props into `events`, with `context` taken from `Effect.context()` while that element's JSX Effect runs (see spec Architecture, Events). Keep non-function `on*` flowing to `checkAttr` so it is still rejected. Carry `key` onto the host element node.
- `jsx()`: pass `key` through to `instance(type, props)` (the call site only; `reactive.ts` consumes it in the next task). `Fragment`, `Provider` and `Boundary` stay special-cased and get no key.
- `string.ts` already reads only known fields; add a test that `events`, `key` and `id` never appear in `renderToString` output.
- Export the new types from `index.ts`.

### Investigation targets
**Required**:
- `packages/ui/src/jsx-runtime.ts:23-35` (`attrs`, `jsx`), `packages/ui/src/node.ts:10-44`
- `packages/ui/src/string.ts:16-30,80-115` (`checkTag`, `checkAttr`, `serialize`)
- `packages/ui/src/handler.ts:24-28,38-41` (tagged-error pattern; `checkEvent` does NOT apply to `events`)
**Optional**:
- `packages/ui/src/__tests__/reactive.test.ts:22-26` (plain-node `toEqual` pattern), `packages/ui/src/__tests__/handler.test.ts:73-83`

### Acceptance
- [ ] A function-valued `onClick` on a host element produces `events.click` with a captured `Context`; no `on*` string attribute is emitted.
- [ ] A non-function `on*` prop is still rejected with `Unsafe attribute`; `Node.on` is still ignored by `mount`.
- [ ] `key` reaches element nodes and is absent from attributes; plain nodes without a key have no `key` property (`toEqual` with `el(...)` holds).
- [ ] `renderToString` output is unchanged by `events`, `key` and `id`.
- [ ] `pnpm --filter @sleekstack/ui test` and `typecheck` pass.

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
