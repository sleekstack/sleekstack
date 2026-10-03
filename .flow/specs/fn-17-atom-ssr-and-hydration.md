## Goal & Context
<!-- scope: business -->

Atoms are client only today: `useAtomValue` and friends throw `AtomsClientOnly` during a server render (fn-7 left SSR out on purpose). That blocks any server-rendered page that shows atom state, and it forces a loading flash on every client navigation.

Make atoms render on the server and hydrate on the client without a mismatch or a refetch: the server renders with atom values, serializes the settled values of opted-in atoms, and the client seeds its store from that snapshot before the first read.

Related: fn-12 (`@sleekstack/query`, unmerged at planning time) ships its own query-only hydration (`<HydrateQueries>`, a `Dehydrated` with `updatedAt`). This spec is the general atom mechanism; the two coexist (query entries keep their own wire format and merge rule) and this spec lands after fn-12 so both edit the same atom hook module once.

## Architecture & Data Models
<!-- scope: technical -->

- **Serializable atoms.** An atom opts in with a stable string key, a `Schema`, and an explicit kind. `Atom.serializable(atom, { key, schema })` is the value kind: the schema describes the atom's value. `Atom.serializable.result(atom, { key, schema })` is the result kind, for atoms whose value is `Result<A, E>` (Effect, Stream, or derived functions returning either): the schema describes the `Success` value `A`. The marker records the kind on the atom, so seeding knows before `read` runs whether to seed raw `A` or `Result.success(A)`. Classification never inspects how `Atom.make` built the atom. Only opted-in atoms cross the wire. The snapshot is `Record<key, encoded value>`, JSON-safe.
- **Server ownership: a request-level wrapper with request-local provider bookkeeping.** `renderWithAtoms` (name open) in `@sleekstack/react` owns a server request: it renders the tree (`renderToString` or `renderToPipeableStream`) under a request registry, and in `try/finally` (including the stream's completion, shell error, error and abort paths) closes every scope the registry handed out, LIFO (deepest provider first, root app scope last), awaiting each close. On the server each `LayerProvider` acquires its scopes through that registry, keyed by the provider's React `useId` (stable across server retries of a suspended boundary in one request), using the same scope construction the client uses: a root provider opens an app scope from its `provide` (or opens on its `appScope`), a nested provider opens a child scope on its parent provider's scope with its own `provide` entries, so `provide`, nesting and shadowing behave exactly as on the client for sync and async layers. Acquisition starts immediately at render (no commit on the server). The module-global parked-scope adoption and the `ADOPT_MS` GC are client only and never touched on the server, so two requests can never share a scope or store.
- **Next.js (no wrapper).** Next owns its render, so `renderWithAtoms` cannot wrap it, and nothing in the client-component SSR pass observes request completion. Without a wrapper registry, a server `LayerProvider` keeps today's service-scope behaviour and serves atoms from an inert per-render store (`AtomStoreOptions.inert`): sync atoms compute, seeded atoms return their seed, unseeded Effect/Stream atoms stay `Initial` and start no fiber, so there is nothing to close. Values come from the server component side: `prefetchAtoms(atoms, options?)` in `@sleekstack/next` runs inside one `runEffect` call (request-scoped runtime), builds a store on that Effect context, waits until each listed result atom leaves `Initial`, dehydrates, and disposes the store before resolving; the page passes the snapshot to the client provider's `hydrate` prop. Its lifetime is the awaited call, so completion is observable.
- **Server reads (suspension model).** Server reads CAN suspend. Under the wrapper, a provider whose scope is still opening suspends on it (as on the client); `useAtomSuspense` on an unsettled result atom suspends on the store; `useAtomValue` on an unsettled result atom returns `Initial`. With `renderToPipeableStream` suspensions are awaited; with `renderToString` a suspended subtree renders its nearest Suspense fallback (documented). In the inert Next path nothing suspends on Effects: unseeded result atoms are `Initial`, and `useAtomSuspense` on one renders the nearest Suspense fallback on the server, the client then loads normally.
- **Dehydrate / hydrate.** `dehydrate(store): Snapshot` returns the settled value of every serializable atom built in the store: value-kind atoms always, result-kind atoms only on `Success` (encoded `A`; `waiting` not sent). `hydrate(store, snapshot)` is public; `AtomStoreOptions.hydrate` calls it at construction. It records seeds; a serializable atom's node is seeded with the decoded value on first read, before `read`, so a seeded result atom does not run its Effect until `refresh`.
- **Transport.** The snapshot reaches the client as `<script type="application/json" data-sleekstack-atoms="<id>">`, emitted by an `AtomsSnapshot` component rendered inside the provider after the atom readers (tree order decides which atoms are built). The id is the provider's optional `snapshotId` prop (empty string when absent). On the client the provider reads the tag whose id equals its `snapshotId`; a provider with no `snapshotId` reads the unkeyed tag only when exactly one such tag exists, otherwise ignores transport. One transport function owns locating, guarded parsing and preserving the tag, used by both the provider and `AtomsSnapshot`. On the client `AtomsSnapshot` re-renders the preserved content without re-dehydrating, so it never causes a mismatch. Inline content is escaped against `</script>`, an HTML comment opener, and U+2028/U+2029.
- **Packages touched:** `@sleekstack/core` (serializable atoms, `dehydrate`, `hydrate`, inert store option), `@sleekstack/react` (server reads, `renderWithAtoms`, `hydrate`/`snapshotId` props, `AtomsSnapshot`, transport), `@sleekstack/next` (`prefetchAtoms`). `@sleekstack/kit` re-exports whatever the facade exposes today and nothing more.

## API Contracts
<!-- scope: technical -->

```ts
// core
declare const SerializableBrand: unique symbol
type Serializable<T extends Atom<any>> = T & { readonly [SerializableBrand]: 'value' | 'result' }   // still assignable wherever T is expected
Atom.serializable<A, I>(atom: Atom<A>, opts: { key: string; schema: Schema.Schema<A, I> }): Serializable<Atom<A>>
Atom.serializable<R, W, I>(atom: Writable<R, W>, opts: { key: string; schema: Schema.Schema<R, I> }): Serializable<Writable<R, W>>
Atom.serializable.result<A, E, I>(atom: Atom<Result<A, E>>, opts: { key: string; schema: Schema.Schema<A, I> }): Serializable<Atom<Result<A, E>>>
type Snapshot = Readonly<Record<string, unknown>>
dehydrate(store: AtomStore): Snapshot
hydrate(store: AtomStore, snapshot: Snapshot): void
AtomStoreOptions.hydrate?: Snapshot            // calls hydrate(store, snapshot) at construction
AtomStoreOptions.inert?: boolean               // Effect/Stream builds never start; unseeded result atoms stay Initial

// react
renderWithAtoms(...)                           // request wrapper; exact signature settled in task 2 (string and stream modes)
<LayerProvider provide={...} hydrate?={Snapshot} snapshotId?={string}>
<AtomsSnapshot />                              // script tag for the nearest provider's store, id = its snapshotId

// next
prefetchAtoms(atoms: ReadonlyArray<Serializable<Atom<any>>>, options?: RunEffectOptions): Promise<Snapshot>   // an unbranded atom is a compile error; rejects like runEffect
```

- The brand is type-only plus the runtime marker that already exists; every API that requires serializability accepts only `Serializable<...>`. Runtime behaviour is unchanged.
- `key` must be unique per store: when a store builds a second, distinct serializable atom with a key already built in it, that read throws `DuplicateAtomKey` (tagged error, carries the key). Re-reading the same atom is not a duplicate.
- `hydrate` rules: an identical snapshot applied again is a no-op; for a key already seeded, the first seed wins; a node already built is never overwritten (its seed is ignored); unknown keys are ignored; an entry failing its `Schema` decode is dropped with a dev warning at first read and the atom loads normally; a non-object snapshot is treated as empty with a dev warning. `hydrate` never throws.
- `dehydrate` on a disposed store returns `{}`. A value that fails `Schema` encode is skipped with a dev warning, never thrown.
- Transport: malformed JSON or a non-object payload becomes an empty snapshot with a dev warning and a normal client load; never throws during hydration.
- The server error `AtomsClientOnly` is removed; reading an atom outside a `LayerProvider` still throws the existing "needs a LayerProvider" error.

## Edge Cases & Constraints
<!-- scope: technical -->

- Per-request isolation: two concurrent server renders (including interleaved suspended retries with identical provider shape) never share a scope, `AtomStore` or snapshot.
- Server scope lifetime: the wrapper closes every registry scope (LIFO, children before parents, atom store before its scope's services) on completion, shell error, error and abort, idempotently; no fiber or finalizer outlives the request. A provider's scope acquisition failure reaches the nearest error boundary, as on the client. Nested and shadowing providers on the server resolve the same services as on the client.
- `prefetchAtoms`: a listed atom that is not serializable is a type error; an atom that settles to `Failure` is omitted (client loads it); a non-control-flow failure of the run rejects; the store is disposed on every path.
- Writable atoms with a seeded value: the seed is the initial value only; later `set` behaves as today.
- A derived atom that is not serializable is recomputed on the client from the seeded sources.
- Values that are not `Schema`-encodable are a type error at `Atom.serializable`; a result atom passed to the value kind without a `Result` schema is the caller's choice and encodes the whole value.
- Suspense: hydration must not flash a fallback for a seeded atom. Late-arriving streamed atoms are out of scope.
- Multiple roots: two independently hydrated providers with different `snapshotId`s each seed only from their own tag.
- Dev-only registry from fn-13 lists seeded atoms like any other built atom.
- `AtomsSnapshot` outside a `LayerProvider` throws the existing "needs a LayerProvider" error.
- fn-12 coexistence: under the wrapper, `<HydrateQueries>` seeds the provider's registry-acquired store on the server; query hydration keeps its own wire format and merge rule.

## Acceptance Criteria
<!-- scope: technical -->

- **R1:** `Atom.serializable` (value kind), `Atom.serializable.result`, `dehydrate`, `hydrate`, `AtomStoreOptions.hydrate` and `AtomStoreOptions.inert` exist in `@sleekstack/core` with the contracts above, with unit tests for: round trip of value, writable and result atoms (including a derived function returning an Effect); result kind sends `Success` only and seeds `Result.success(A)` without running the Effect; duplicate key (`DuplicateAtomKey`, same-atom re-read fine); unknown key ignored; failed decode dropped with warning; failed encode skipped; non-object snapshot; disposed store; `hydrate` with an identical snapshot is a no-op, a different snapshot for an already-seeded key keeps the first seed, and a built node is never overwritten; both markers return the branded `Serializable` type, assignable where the plain atom is expected (type test with `@ts-expect-error` and a compiling twin); an inert store forks no fiber, keeps unseeded result atoms `Initial` and returns seeds.
- **R2:** `renderWithAtoms` exists; inside it `useAtomValue`, `useAtom`, `useAtomSet`, `useAtomRefresh` and `useAtomSuspense` work during a server render (`renderToString` and `renderToPipeableStream`); `AtomsClientOnly` is gone. Error/boundary cases: outside a provider the existing error; nested providers with their own `provide` and a child shadowing a parent entry resolve the same services on the server as on the client, with sync and async layers; an async-opening scope suspends (stream waits; `renderToString` renders the Suspense fallback); `useAtomValue` on an unsettled result atom renders `Initial`; all registry scopes close LIFO (finalizer order asserted, no live fibers) after completion, after a shell error, and after abort; a provider retried after suspension reuses its scope within the request; two concurrent streaming renders with identical provider shape, different values and interleaved suspended retries see only their own values; the server path never touches parked-scope adoption; a server provider without a wrapper serves atoms from an inert store. `LayerProvider` render makes a single call to one helper that chooses between registry, inert-server and client acquisition.
- **R3:** A server render followed by `hydrateRoot` with the dehydrated snapshot produces no hydration mismatch warning and no second run of a seeded result atom; covered by a jsdom test. Boundary cases: seeded atom shows no Suspense fallback; `refresh` re-runs it; a non-serializable derived atom recomputes from seeded sources; a decode failure falls back to a normal load; malformed transport JSON yields an empty snapshot, a dev warning and a normal load; two roots with different `snapshotId`s and values each hydrate their own values; a provider without `snapshotId` ignores transport when more than one unkeyed tag exists.
- **R4:** `AtomsSnapshot` emits an escaped JSON script tag carrying the provider's `snapshotId`; a value containing `</script>`, an HTML comment opener or U+2028/U+2029 cannot break out and round-trips intact (test); its client render causes no mismatch; outside a provider it throws the existing error.
- **R5:** `@sleekstack/next` exposes `prefetchAtoms`, which accepts only branded `Serializable` atoms (type test: an unbranded atom fails with `@ts-expect-error`, a branded twin compiles) (unit tests: success snapshot, `Failure` omitted, run failure rejects, store disposed on every path); a new showcase atom page awaits `prefetchAtoms` in its server component and passes the snapshot to a client `LayerProvider` via `hydrate`; an e2e test asserts the server HTML contains the seeded value and the client does not re-run the seeded Effect.
- **R6:** Docs: atom guide section on SSR and hydration (wrapper, `snapshotId`, `renderToString` caveat), README updates for core, react and next, ADR 0016 (opt-in serializable atoms with explicit kind, wrapper-owned request registry, inert store and `prefetchAtoms` for Next, per-store key uniqueness, relation to fn-12 query hydration), CONTEXT.md terms (Serializable Atom, Snapshot).

## Early proof point

Task fn-17-atom-ssr-and-hydration.2 validates the core approach (a request-level `renderWithAtoms` registry lets server providers open their scopes with the shared client construction, keeps nesting and shadowing, survives Suspense retries via `useId`, isolates concurrent streaming requests, and closes everything on completion and abort with no leaked fibers). If it fails, re-evaluate server-side atom support (for example the inert-store-plus-prefetch model for all hosts) before continuing with fn-17-atom-ssr-and-hydration.3+.

## Execution waves

1. .1  2. .2  3. .3  4. .4 and .5 in parallel.

## Boundaries
<!-- scope: technical -->

- No streaming of late atoms, no RSC-native atoms, no persistence to storage, no cross-tab sync.
- No change to Effect/Stream atom semantics on the client.
- No new package. No change to fn-12's query hydration wire format.

## Decision Context
<!-- scope: technical -->

- Opt-in per atom (explicit key and schema) rather than serializing every atom: a snapshot of everything leaks server-only values and makes the payload unbounded. Same trade-off effect-atom makes with `Atom.serializable`.
- Settled `Success` only: sending `Initial` or `Failure` would freeze a transient state on the client.
- Seed on first read, not on provider mount, so unused atoms cost nothing.
- Rejected: provider-owned server scope, because render completion and abort are unobservable from a component (no effects or cleanup run on the server).
- Rejected: reusing the parent store for a nested server provider, because it drops the provider's `provide` entries and shadowing.
- Rejected: identifying server providers by props or shape, because retries re-render with new props; `useId` is position-stable within a request.
- Rejected for Next: a per-request store in the client-component SSR pass, because Next owns the render and exposes no completion hook to that pass (`after()` and `cache()` live in the server-component graph, which does not share module state or objects with the SSR pass beyond serialized props).
- Rejected: reusing parked-scope adoption on the server, because its module-global shape matching can hand one request's scope to another.
- Rejected: inferring result kind from `Atom.make`, because derived functions returning Effects and plain values share one branch.
- Rejected: a global key registry checked at `Atom.serializable` time, because it breaks HMR and module re-evaluation; uniqueness is per store.
- Rejected: one unkeyed transport tag per page, because sibling roots would seed from each other's snapshot.

## Open Questions
<!-- scope: technical -->

- Name: `Atom.serializable` (matches effect-atom) vs `Atom.persist`. Default: `serializable`.
- Wrapper name: default `renderWithAtoms` in `@sleekstack/react`; `prefetchAtoms` in `@sleekstack/next`.
- Families: `Atom.serializable` inside an `Atom.family` callback needs a per-argument key. Default: the caller builds the key from the argument.

## Quick commands
<!-- scope: technical -->

- `pnpm --filter @sleekstack/core test`
- `pnpm --filter @sleekstack/react test`
- `pnpm --filter @sleekstack/next test`
- `pnpm typecheck && pnpm test`

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `Atom.serializable` (value kind), `Atom.serializable.result`, `dehydrate`, `hydrate`, `AtomStoreOptions.hydrate` and `AtomStoreOptions.inert` exist in `@sleekstack/core` with the contracts above, with unit tests for: round trip of value, writable and result atoms (including a derived function returning an Effect); result kind sends `Success` only and seeds `Result.success(A)` without running the Effect; duplicate key (`DuplicateAtomKey`, same-atom re-read fine); unknown key ignored; failed decode dropped with warning; failed encode skipped; non-object snapshot; disposed store; `hydrate` with an identical snapshot is a no-op, a different snapshot for an already-seeded key keeps the first seed, and a built node is never overwritten; both markers return the branded `Serializable` type, assignable where the plain atom is expected (type test with `@ts-expect-error` and a compiling twin); an inert store forks no fiber, keeps unseeded result atoms `Initial` and returns seeds. | fn-17-atom-ssr-and-hydration.1 | — |
| R2 | `renderWithAtoms` exists; inside it `useAtomValue`, `useAtom`, `useAtomSet`, `useAtomRefresh` and `useAtomSuspense` work during a server render (`renderToString` and `renderToPipeableStream`); `AtomsClientOnly` is gone. Error/boundary cases: outside a provider the existing error; nested providers with their own `provide` and a child shadowing a parent entry resolve the same services on the server as on the client, with sync and async layers; an async-opening scope suspends (stream waits; `renderToString` renders the Suspense fallback); `useAtomValue` on an unsettled result atom renders `Initial`; all registry scopes close LIFO (finalizer order asserted, no live fibers) after completion, after a shell error, and after abort; a provider retried after suspension reuses its scope within the request; two concurrent streaming renders with identical provider shape, different values and interleaved suspended retries see only their own values; the server path never touches parked-scope adoption; a server provider without a wrapper serves atoms from an inert store. `LayerProvider` render makes a single call to one helper that chooses between registry, inert-server and client acquisition. | fn-17-atom-ssr-and-hydration.2 | — |
| R3 | A server render followed by `hydrateRoot` with the dehydrated snapshot produces no hydration mismatch warning and no second run of a seeded result atom; covered by a jsdom test. Boundary cases: seeded atom shows no Suspense fallback; `refresh` re-runs it; a non-serializable derived atom recomputes from seeded sources; a decode failure falls back to a normal load; malformed transport JSON yields an empty snapshot, a dev warning and a normal load; two roots with different `snapshotId`s and values each hydrate their own values; a provider without `snapshotId` ignores transport when more than one unkeyed tag exists. | fn-17-atom-ssr-and-hydration.3 | — |
| R4 | `AtomsSnapshot` emits an escaped JSON script tag carrying the provider's `snapshotId`; a value containing `</script>`, an HTML comment opener or U+2028/U+2029 cannot break out and round-trips intact (test); its client render causes no mismatch; outside a provider it throws the existing error. | fn-17-atom-ssr-and-hydration.3 | — |
| R5 | `@sleekstack/next` exposes `prefetchAtoms`, which accepts only branded `Serializable` atoms (type test: an unbranded atom fails with `@ts-expect-error`, a branded twin compiles) (unit tests: success snapshot, `Failure` omitted, run failure rejects, store disposed on every path); a new showcase atom page awaits `prefetchAtoms` in its server component and passes the snapshot to a client `LayerProvider` via `hydrate`; an e2e test asserts the server HTML contains the seeded value and the client does not re-run the seeded Effect. | fn-17-atom-ssr-and-hydration.4 | — |
| R6 | Docs: atom guide section on SSR and hydration (wrapper, `snapshotId`, `renderToString` caveat), README updates for core, react and next, ADR 0016 (opt-in serializable atoms with explicit kind, wrapper-owned request registry, inert store and `prefetchAtoms` for Next, per-store key uniqueness, relation to fn-12 query hydration), CONTEXT.md terms (Serializable Atom, Snapshot). | fn-17-atom-ssr-and-hydration.5 | — |
