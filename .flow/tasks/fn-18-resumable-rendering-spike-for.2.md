---
satisfies: [R2, R3, R4, R5]
---
# fn-18-resumable-rendering-spike-for.2 ui: resume runtime (delegation, lazy handlers, bound text, lifecycle)

Touches: [packages/ui/src/resume.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/resume.test.ts]

## Description
Build `resume` (R2-R5), the client half: read the manifest, seed an owned `AtomStore`, subscribe bound text, install delegated listeners, load handler chunks lazily, run them in one FIFO queue with the layer, and clean up on `dispose`. This task is the early proof point: a server-rendered tree resumes with zero component calls.

**Size:** M
**Files:** `packages/ui/src/resume.ts` (new, must not import React or `component.ts`), `packages/ui/src/index.ts`, `packages/ui/src/__tests__/resume.test.ts` (new, jsdom).
**Touches:** [packages/ui/src/resume.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/resume.test.ts]

### Approach
- Single-activation per container via a WeakMap, as Islands does (`packages/islands/src/Island.tsx:35-41`); an activation token is checked after every await (chunk load, queue step) so a late run after `dispose` or a second `resume` does nothing (memory: island async chunk load).
- Rejection contract for manifest/layer failures follows `runToNode` (`packages/ui/src/component.ts:34-47`): original error, never a `FiberFailure`; container untouched on rejection. Missing, multiple or malformed manifest is `ManifestInvalid`; a bound value that fails to decode is `ManifestDecodeFailed` naming the key (deliberately stricter than fn-17's `hydrate`).
- Delegation: one listener per manifest event type; apply `data-sleek-pd-*` / `data-sleek-sp-*` flags synchronously; snapshot `value`/`checked` only for input/textarea/select targets; closest `[data-sleek-on-<event>]` element only. Loader result must have `default.id === key` else `HandlerIdMismatch`.
- Queue: one FIFO per `resume`; chunk loads overlap, runs do not. A rejected import is not cached; runtime errors go to `onError` and drop only that run.
- Run each handler as an Effect with the layer in a client Scope; `dispose` closes the Scope (fibers interrupted, memory: fibers forked outside atom builds), disposes the store and removes listeners. The `atoms` option maps manifest keys to Atom objects; subscribe all bound nodes before installing listeners.
- Replay of pre-resume events is out of scope.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/component.ts:34-62` — layer run and error reporting contract
- `packages/islands/src/Island.tsx:28-73` — activation and registry pattern
- `packages/islands/src/replay.ts:10-25` — which targets have native defaults (for flag semantics)
- `packages/core/src/atom/AtomStore.ts:28-72` — `subscribe`, `set`, `dispose`

**Optional** (reference as needed):
- `packages/ui/src/__tests__/dom.test.ts` — jsdom pattern

### Key context
Tests must not read the build-generated `.sleekstack` report. A component spy counts calls to prove R2.

### Acceptance
- [ ] Resume over `renderToString` output (jsdom): component spy count is zero after resume; a click runs a lazily loaded handler that writes an atom and updates every bound node
- [ ] Loader runs only on the first matching event, once across many; mixed-id events run in event order; concurrent events during load queue correctly
- [ ] Static `preventDefault` / `stopPropagation` applied before the chunk loads; nested handlers: only the closest runs; `value`/`checked` snapshot from form controls only
- [ ] Error cases from R2/R3/R5: `ManifestInvalid`, `ManifestDecodeFailed` (container untouched), layer error, `UnknownHandler`, `HandlerIdMismatch`, rejected import then retry, failing handler leaves DOM, late run after `dispose` / second `resume` dropped; second `resume` returns first handle; `resume` after `dispose` works; `dispose` interrupts a forked fiber
- [ ] `pnpm --filter @sleekstack/ui test` and typecheck pass

## Acceptance
- [ ] TBD

## Done summary
`resume` runtime (delegated listeners, lazy handlers in one FIFO queue, bound text, scoped lifecycle). Per the user's decision, `bind`/`resume` accept only serializable value-kind atoms: a new `UnsupportedAtom` tagged error is thrown at bind time, at render (hand-built Bind nodes), and at resume. Every bound atom now seeds through the store hydrate seed, and the plain-atom `set`/unseeded paths are gone. Spec error list updated. Tests: handler.test.ts covers bind/render rejection, resume.test.ts covers resume rejection with the container untouched.

Drift: Bind renders `<sleek-bind data-sleek-bind>`; handlers write through the Store service (layer is `Layer<Exclude<R, Store>>`); resume entry is React-free.

Tier: implementer opus at medium
stage: impl-review - ran (codex re-review on open receipt, SHIP)
## Evidence
- Commits: 3fb57126bc20ab61e38ce184e1fdc4fe34ff5fa9, 57cf65ee0b8a52ffc9c2ab432d0129b1c3f4be7f, 76b83c29f71e44d2cdae5f272fdac566f00e4259, 602bba39890cc563e872ad93c0d8d0dff8e70eb0, 86fe5d9c77054873de5b5f4319505bba428c2bac, 6ac32dc6fa08a8542d6e1da477bc815a423ddc55
- Tests: pnpm typecheck, pnpm test
- PRs: