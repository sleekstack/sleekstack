---
satisfies: [R1]
---
# fn-17-atom-ssr-and-hydration.1 Core: Atom.serializable, dehydrate, store seeding

Touches: packages/core/src/atom/**, packages/core/src/errors.ts, packages/core/src/index.ts

## Description
Size: M. Implements the core half of the API Contracts section (R1).

**Touches:** packages/core/src/atom/**, packages/core/src/errors.ts, packages/core/src/index.ts

**Files:**
- `packages/core/src/atom/Atom.ts` - `serializable` and `serializable.result` (mark the atom like `keepAlive`/`setIdleTTL` at :160-163 do, spreading a field `{ key, schema, kind: 'value' | 'result' }`; keep read/write and the `Writable` overload)
- `packages/core/src/atom/AtomStore.ts` - `hydrate` option on `AtomStoreOptions` (:14), public `hydrate(store, snapshot)` and `dehydrate`, per-store seed and key tables
- `packages/core/src/errors.ts` - `DuplicateAtomKey` tagged error next to `AtomCycle`
- `packages/core/src/index.ts` - export `dehydrate`, `hydrate`, `Snapshot` (:28 area)
- `packages/core/src/atom/__tests__/` - new serialize test file

## Approach
- Kind comes only from the marker (spec: never from `make`'s branches). Seeding a `result` atom sets `Result.success(decoded)`; a `value` atom sets the decoded value.
- `hydrate(store, snapshot)`: if `snapshot` is not a plain object, dev-warn and return. For each key: skip if a seed for that key is already recorded (first wins) or a built node with that key exists (never overwrite). Seeds are raw encoded values; decode lazily at first read so a decode failure only affects that atom (dev-warn, normal `read`).
- First read: in `pull` for an `uninit` node whose atom is serializable and has a pending seed, decode, set value, mark `valid`, consume the seed, skip `read` (so no fork). A later `refresh` recomputes normally and records deps.
- `hydrate` needs store internals: either a method on the `AtomStore` interface marked `@internal` that the exported function calls, or a WeakMap side table. Prefer the internal method (same pattern as `inspect` at :47).
- Key uniqueness: per-store `Map<key, Atom>` filled when a serializable node is built; a different atom with the same key throws `DuplicateAtomKey`; clear on node removal.
- `dehydrate` walks built nodes (same source as `inspect` at :332): `value` atoms always, `result` atoms only on `Success`; `Schema.encodeSync` in try/catch (dev-warn, skip). Disposed store returns `{}`.
- Brand: export `Serializable<T>` (type-only unique-symbol brand, `T & { readonly [SerializableBrand]: kind }`); both markers return it via a cast over the existing runtime marker. No runtime change.
- `inert` option: when set, `fork` (BuildContext at AtomStore.ts:173) never calls `Effect.runFork`; the build returns no exit, so result atoms stay `Initial`, and Stream builds likewise start nothing. Seeds still apply. No timers needed (pass no idle TTL).
- Dev warnings gated on `NODE_ENV !== 'production'` like `packages/react/src/LayerProvider.tsx:689`.

## Investigation targets
**Required:**
- `packages/core/src/atom/AtomStore.ts` - `ensure`, `pull`, `recompute`, `remove`
- `packages/core/src/atom/Atom.ts` - `make` overloads, marker helpers
- `packages/core/src/atom/Result.ts`
**Optional:**
- `.claude/worktrees/fn-12/packages/query/src/hydrate.ts` - fn-12's Schema encode/decode handling; reuse conventions

## Acceptance
- [ ] `Atom.serializable`, `Atom.serializable.result`, `dehydrate`, `hydrate`, `Snapshot`, `AtomStoreOptions.hydrate`, `AtomStoreOptions.inert`, `DuplicateAtomKey` exported from `@sleekstack/core` with the overloads in API Contracts
- [ ] Round trip tests: value, writable, result atoms, and a derived function returning an Effect marked `.result`
- [ ] Result kind: Success-only dehydrate; seeded atom reads `Result.success(A)` and runs its Effect zero times until `refresh`
- [ ] Error cases: duplicate key (and same-atom re-read fine), unknown key, failed decode, failed encode, non-object snapshot, disposed store
- [ ] `hydrate`: identical snapshot no-op; different snapshot for a seeded key keeps the first; built node never overwritten
- [ ] Inert store: zero fibers forked, unseeded result atom `Initial`, seeded atom returns its seed, sync atoms compute
- [ ] Type test: markers return `Serializable<...>`, still assignable to `Atom`/`Writable`; a function accepting `Serializable<Atom<any>>` rejects an unbranded atom (`@ts-expect-error`) and accepts the branded twin
- [ ] Non-encodable value types are a compile error (type test); `pnpm --filter @sleekstack/core test` and typecheck pass

## Done summary
Added `Atom.serializable` / `.result` (type-only `Serializable` brand), `dehydrate`, `hydrate`, `Snapshot`, `AtomStoreOptions.hydrate` / `inert`, and `DuplicateAtomKey` in @sleekstack/core; seeds decode lazily at first read and skip `read`. Tests: packages/core/src/atom/__tests__/serialize.test.ts and serialize-types.test-d.ts.

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixed __proto__ key, hydrate input guard, created-node overwrite -> SHIP)
## Evidence
- Commits: ea2f2d9be608eabaebf0d7d8ad483f6bf8111dee, 443b9cd6aafd3daeb4bcf88b1d73d76eafd875f3
- Tests: pnpm --filter @sleekstack/core test, pnpm typecheck && pnpm test
- PRs: