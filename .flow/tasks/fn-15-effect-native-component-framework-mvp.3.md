---
satisfies: [R1, R6]
---
# fn-15-effect-native-component-framework-mvp.3 ui minimal DOM renderer with re-mount and onError

## Description
Add the DOM renderer: `mount` with a `container` renders the same `UserCard` tree into a jsdom document, and mounting again on the same container replaces it (R6), and completes R1 for `mount` (the DOM half of the API). No fine-grained updates.

**Size:** M
**Files:** `packages/ui/src/dom.ts`, `packages/ui/src/index.ts`, `packages/ui/vitest.config.ts`, `packages/ui/src/__tests__/dom.test.ts`
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/string.ts, packages/ui/src/index.ts, packages/ui/vitest.config.ts, packages/ui/src/__tests__/dom.test.ts, packages/ui/package.json]

## Approach
- `mount` per spec API Contracts in `dom.ts`, resolving to `Mounted`; reuse .1's run-and-unwrap helper without editing `component.ts` (task .2 owns type fixes there; if the helper must change, change `string.ts`'s export only). Build DOM nodes from the `Node` tree with `document.createElement`/`createTextNode`; set attributes, never `innerHTML`.
- Guests: one `react-dom/client` `createRoot` per guest host element; keep roots per container and `unmount()` them before re-mount and on dispose. Re-mount clears the container's previous content and roots first.
- Per-container generation token: bump it when `mount` starts; after the Effect run resolves, if the token moved, discard the result (no DOM writes, no roots). Same pattern as the islands activation token. Each `Mounted` handle captures its own generation: `dispose()` on an obsolete handle (including the eventual handle of a superseded in-flight mount) does nothing to the container or to newer roots. Guest roots are rendered inside `flushSync` so the guest DOM exists when the mount promise resolves; a guest commit that throws renders nothing, goes to `onError`/`console.error`, and the promise still resolves.
- Render failures (guest throws, DOM error) follow the spec's renderer-failure rule; the renderer never throws. `E`/`LE` failures reject per spec.
- Tests: per-file `// @vitest-environment jsdom` or switch the package env, `IS_REACT_ACT_ENVIRONMENT = true`, wrap in `act` from `react`, unmount roots in `afterEach`. Add tests for: (a) `a = await mount(...)`, `b = await mount(...)` on one container, then `a.dispose()` leaves B's DOM and roots intact; (b) a superseded in-flight mount's eventual handle disposes as a no-op; (c) the guest DOM already exists when the mount promise resolves, asserted before the enclosing `act` finishes flushing.

## Investigation targets
**Required**:
- `packages/ui/src/string.ts` — the tree walk to mirror (from .1)
- `packages/react/vitest.config.ts` — jsdom setup
- `packages/islands/src` — existing createRoot/unmount handling for detached roots

## Key context
- Memory: island roots must check an activation token before creating a root; a re-mount racing an in-flight mount must not leave the old root.


## Acceptance
- [ ] `UserCard` mounts into a jsdom container with the expected DOM (R6).
- [ ] Re-mounting on the same container replaces content and unmounts old guest roots (no duplicate root warning).
- [ ] Dispose empties the container and unmounts the guest roots of its own mount; disposing an obsolete handle (`a.dispose()` after a newer `b`) leaves B's container and roots intact (R6).
- [ ] Guest DOM exists when the mount promise resolves, before the enclosing `act` flushes (R6).
- [ ] A throwing guest renders as nothing, the cause reaches `onError`, and `mount` neither throws nor rejects (R6).
- [ ] Race: a first `mount` held on a deferred layer, then a second `mount` that completes; releasing the first leaves the container and guest roots exactly as the second made them.
- [ ] Uncaught `UserNotFound` rejects `mount` with the original instance.
- [ ] `pnpm --filter @sleekstack/ui test` passes with no act warnings.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
