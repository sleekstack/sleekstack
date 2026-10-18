## Conversation Evidence

- [user] "enrich model package with functionality similar to EmberData"
- [user] features: "Identity map / store, Relationships, Dirty tracking and rollback, Adapters and serializers"
- [user] "We need to tailor it to Effect environment as we have schema there and also atoms and query"
- [user] "ignore previous adrs, the effect-native feature are top priority" (ADR 0038's rejection of relationships and a record store does not block this)
- [user] "can the model accept the adapter itself instead of wiring it in query?"
- [user] "can we just merge model and draft into a single model? like ember and warpdrive"
- [user] "make transformations more like https://warp-drive.io/guides/the-manual/schemas/transformations"
- [user] "our previous transformation should actually live inside adapter right?" then "yes, update fn-58 with that split"
- [paraphrase] A model panel (Claude, Codex, Cursor) advised against building; the user overrode it. Its design findings are kept below as constraints.

## Goal & Context
<!-- scope: business -->

`@sleekstack/model` holds a Model (pure `fromDto`), a Draft Spec and `useDraft`, but no record identity. This adds an EmberData/WarpDrive-style records layer built from Effect parts: Effect Schema, Atoms in the scope's Store, Services as Layers, and `@sleekstack/query`. One record per type and id is shared by every view, relationships follow it, saves write back, and the adapter is a Service a test can swap. [paraphrase]

The layer has three parts with one job each:

| Part | Owns |
|---|---|
| **Record** (`defineRecord`) | fields (Effect Schema), per-field transformations, relationships (`ref`, `refs`), which adapter to use |
| **Adapter** (one `Effect.Tag` per record type, app-written, supplied as a Layer) | the wire contract: response envelope and normalization, the request body, the PATCH shape |
| **Draft** | input validation, `dirty`, `reset`, `errors`, `toModel` preview, typed change values |

## Architecture & Data Models
<!-- scope: technical -->

- **Placement:** in `@sleekstack/model`, flat exports, plus the optional entry `@sleekstack/model/query` for the Query Client wrapper. Records code must tree-shake out of a Draft-only bundle (`sideEffects: false`, ADR 0022 budget measured). [inferred]
- **Record definition:** `defineRecord(type, { fields, adapter? })`: fields are Effect Schema, `field(...)`, `ref` and `refs`. One definition holds the read shape, the editable input fields and the adapter; the Draft is derived from it by default (editable fields, seeded from the record), and `useDraft(spec, src)` stays as the escape hatch. The record in the map and the Draft stay two objects; an edit never touches the shared record. Name must not be `Record` or `Entity` (clashes with TS `Record`, Effect `Record`, CONTEXT `_Avoid_`). [paraphrase]
- **Per-field transformations (WarpDrive style):** `defineTransformation(name, options => { from, to, hydrate, serialize, defaultValue })`, a typed Schema factory attached as `field(Money, { currency })`. `hydrate` runs when wire data becomes a record, `serialize` when typed Draft values become a change, `defaultValue` for a new record. Both directions return typed `ParseError`. Passed as a value (no string registry). No whole-record argument: a field never reads other fields. A computed field is a derived atom, not a transformation. [paraphrase]
- **Adapter owns the wire contract:** methods are typed Effects (`find(id)`, `save(id, change)`, optional `list`) returning raw wire data and failures in `E`; its Layer implements the envelope unwrap and the request or PATCH body, so swapping REST for GraphQL changes the Layer only. The package defines the shape, not the Tags. A record with no adapter has only `push`, `atom` and `related`. [paraphrase]
- **Identity map:** one atom per `(type, id)` in the scope's Store. Retention is explicit: a record atom stays alive until the Store scope is disposed or `evict(type, id)`; never rely on idle removal (an unread `push` is dropped on the next microtask). [inferred]
- **Ingest:** `push(wire)` is an Effect that runs field `hydrate` and writes; its target Store is explicit (a Service in `R`), because `effectFn` does not inherit a component's Store. Whole-record replace, last ingest wins; complete records with server ids only in v1. `find(id)` is `adapter.find`, then `push`, with in-flight calls for one id de-duplicated; no caching or stale handling without the query wrapper. [paraphrase]
- **Relationships:** `ref` (to-one) and `refs` (to-many) are live derived atoms over the map, never fetch on read. A value keeps the id and its position: `Ref { id, value: Option<M> }`; missing targets are kept, not filtered; collection order is the server's. One stable atom per id and field. No inverse sync in v1: one direction is authoritative, reverse views cover loaded records only. [paraphrase]
- **Commit and dirty tracking:** `useDraft` already gives `dirty`, `reset`, `errors`. `commit(id, draft)`: Draft values go through field `serialize` to a typed change, `adapter.save(id, change)` shapes and sends it, the response is hydrated and pushed into the map. v1 is pessimistic. A save acknowledgement never resets a Draft edited while saving; a failed save leaves the map and the Draft unchanged. Optimistic writes (applying `toModel`) are deferred until rollback can remove only its own change. [paraphrase]
- **`DraftSpec.toDto` stays** for standalone `useDraft` use, unchanged; for records, the wire body is the adapter's job and `DraftSpec.toDto` is not required. [paraphrase]
- **Query wrapper** (`@sleekstack/model/query`): optional. The entry exports `queryOf(record)`, which returns the record's query binding (`queryOf(Post).query(id)`); the base entry never imports `query` and nothing registers at import time (`sideEffects: false`). The binding wraps `find` with `effectFn` and a key to add caching, de-duping and stale handling, and covers a cache hit and hydrated state. The binding is a fetch strategy for `useRecord`: `useRecord(Post, id, { via: queryOf(Post) })` swaps the default fetch (the record's own `find`) for one run through the Query Client service (`QueryClientTag`, `effectFn`, key `[type, id]`), not through `useQuery`. Nothing else needs `query`. [paraphrase]
- **`useRecord(record, id, options?)`** (base entry, no `query` import): a slot hook that reads `record.atom(id)` (the identity map is the source of truth), runs `find` once when the slot is empty through an Effect atom held by the Store, and returns a `Result` of the record: waiting on first load, success with the map's value (kept during a refetch), typed failure when the slot is empty and the fetch failed. `options.via` accepts a fetch strategy; its type lives in the base entry and the default is the record's own `find`. [paraphrase]
- **Acknowledgement ordering:** each slot keeps the time of its last acknowledged save. An ingest from the query cache or a hydrated entry carries the entry's own update time (the cache's `dataUpdatedAt`) and is dropped unless it is strictly newer than the slot's last acknowledgement (a tie is dropped, so a cache entry and an acknowledgement sharing one timestamp cannot replay the old value); after a commit the query binding writes the acknowledged wire into the record's query entry. `find` ingests use the per-record counter taken at request start. A cache entry older than a commit therefore cannot overwrite the saved record. [inferred]

## API Contracts
<!-- scope: technical -->

- New public names are unique across all entry points (ADR 0019 test). [inferred]
- Failures are typed in `E` (`ParseError`, adapter failures, a not-found failure); services are in `R`, so `sleekstack check` reports a missing adapter. [inferred]
- The Analyzer recognises each public slot-taking record hook (`record.useDraft(id)` and `useRecord`) by its declaration and reports a conditional call, even when it delegates to `useDraft`; the Analyzer does not follow wrappers, so a fixture covers it. [inferred]

## Edge Cases & Constraints
<!-- scope: technical -->

- Overlapping saves and a stale fetch landing after a save: rule defined before release (serialize or reject concurrent saves of one record; ingest never applies an older fetch over a newer ack). [paraphrase]
- SSR: map atoms are `Atom.serializable` per record or the map is documented client-only; chosen in the first task. [inferred]
- Partial records and unknown relationship membership are unsupported in v1 and fail clearly. [inferred]
- A derived Draft holds the record's encoded form (Draft Type equals Encoded); a field with a transformation, such as a date, holds the input string, and `serialize` runs only at commit. [inferred]
- Size budget (ADR 0022) re-measured. [inferred]
- Derived Draft baseline after a save: standalone `useDraft` keeps an edited Draft's old seed when its source changes, which would report a Draft returned to the old value as clean. The derived Draft updates its baseline to the acknowledged record while keeping edits made during the save, without changing standalone `useDraft`. Sequence to hold: value A, submit B, edit to C, acknowledge B; then B reads clean and A reads dirty. [inferred]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Pushing the same `(type, id)` from two sources yields one atom and one value; unread records survive until scope disposal or `evict`. Errors: a hydrate failure is a typed `ParseError`, no partial write.
- **R2:** `ref` and `refs` update when either side's record changes, keep ids and order for missing targets, and never start a request on read.
- **R3:** A field transformation hydrates on `find` and `push`, serializes on `commit`, supplies `defaultValue` for a new record, and is reusable across records; a failure in either direction is a typed `ParseError`.
- **R4:** `find` and `commit` work through the record's adapter Tag with no `query` installed; a missing adapter Layer is reported in `R`, and a fake Layer replaces it in a test; the same record works over two adapter Layers with different envelopes and PATCH shapes; `useRecord(Post, id)` returns the shared record as a `Result` (waiting on first load, success with the map's value, typed failure) and keeps showing the record during a refetch, with no `query` installed; a conditional `useRecord` call is reported by `sleekstack check`.
- **R5:** `commit` writes the saved record into the map; a failed save leaves the map and the Draft unchanged and returns typed failures; a Draft edited during the save keeps its edits; a record with no explicit `draft` section gets a derived Draft whose baseline moves to the acknowledged record (A, submit B, edit C, acknowledge B: B clean, A dirty); a conditional `record.useDraft(id)` call is reported by `sleekstack check`.
- **R6:** `queryOf(Post).query(id)` caches, de-dupes and ingests results from a fetch, a cache hit and a hydrated state into the same atoms; a cache entry older than a committed save cannot overwrite the saved record; `useRecord(Post, id, { via: queryOf(Post) })` fetches through the Query Client with the same result states; entry `@sleekstack/model/query` is the only one that needs `query`, and the base entry loads none of it.
- **R7:** A Draft-only bundle holds no records code; the size budget test passes; `useDraft(spec, src)` and `DraftSpec.toDto` behave as before.
- **R8:** A new ADR supersedes ADR 0038's "Rejected" line on relationships and a record store and records the three-part split; CONTEXT.md defines the new terms (avoiding `Record` and `Entity`); the Models guide and the model README document it; AGENTS.md verify row for model still holds.

## Quick commands

```bash
pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze
```

## Early proof point

Task fn-58-effect-native-records-layer-in.1 validates the core approach (one `keepAlive` registry per Store gives one stable atom per type and id, surviving idle removal and `evict`). If it fails, re-evaluate the identity-map storage (registry atom versus `AtomStore.retain` per slot) before continuing with fn-58-effect-native-records-layer-in.2 onward.

## Boundaries
<!-- scope: business -->

- No inverse sync, no optimistic shared writes, no partial records, no pagination or polymorphism in v1.
- No HTTP client, JSON:API format or global dispatcher; adapters are app-written Services.
- No change to `ModelSpec`, `DraftSpec` or `useDraft` behavior.
- No built-in transformations that Effect Schema already covers (dates, number-from-string).

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

The user ranks the Effect-native records layer above the earlier decision to leave it out. [paraphrase]

### Implementation Tradeoffs
<!-- scope: technical -->

A panel advised a separate `@sleekstack/records` package and no build; the user chose to build and asked to enrich the model package, so it goes in `model` with a tree-shakable layout. The adapter lives on the record (not wired inside each query), so fetching works without TanStack and `./query` only adds caching. Wire shape (envelope, request body, PATCH) lives in the adapter, per-field formats on the record, input on the Draft, as WarpDrive splits handlers from schema transformations. Rejected: a separate store with its own fetching (a second cache beside the Query Client); records as `Atom.family` keyed by id alone (identity is type plus id); one shared object for record and edit (edits would leak into the shared record); a whole-record two-way codec (ADR 0038); a string registry for transformations (types would not flow). [paraphrase]

### Resolved while planning
<!-- scope: technical -->

Settled by the scouts and the gap analysis, with the defaults they recommended:

- **Identity map storage:** one `keepAlive` registry atom per Store holds a map from `(type, id)` to a writable slot atom. State never lives in `Atom.family` (weak references can drop an atom and split identity); `Atom.family` is used only for the stateless reader atom per `(type, id)`, shared across definitions, while the slots stay kept alive. `evict` resets the slot to `None` and keeps the atom, so a re-`push` never builds a second atom. Ids are strings in v1.
- **Store access:** `push`, `find` and `commit` take the Store as a Service (the `Store` Tag `draft.ts` already uses from the ui internal entry). The Query Client Layer must be given the same Store and the adapter Layer; `effectFn` does not inherit a component's Store.
- **Overlapping saves:** a second `commit` of one `(type, id)` while one is in flight fails with a typed `SaveInFlight`. Each ingest carries a per-record counter taken when its request started, and a response older than the last acknowledgement is dropped.
- **SSR:** the map is client-only in v1 and documented so. `queryOf(Post).query` ingests on every read, including a hydrated cache hit, so the map rebuilds from the Query cache after hydration. No record atom is `serializable`.
- **Draft after commit:** a pristine Draft re-seeds from the pushed record through the existing `useDraft` rule; an edited Draft keeps its edits and its `dirty` is measured against the new seed.
- **Relationship value:** `RecordRef { id, value: Option<M> }`, no per-collection "complete" flag (partial membership is unsupported). A relationship read depends on the registry slot, so a late `push` of a missing target re-runs it.
- **Names:** `defineRecord`, `defineTransformation`, `field`, `ref`, `refs`, `RecordRef`. Not `Record`, `Entity` or `Ref` (clashes with TS, CONTEXT `_Avoid_` and Effect's `Ref`).
- **Scope disposal:** an in-flight `find` or `commit` is owned by the Store's scope; disposing the scope interrupts it and writes nothing.
- **New-record Draft:** `defaultValue` seeds the Draft of a create form (`useDraft` with no source record); there is no separate `create()` API.


## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | Pushing the same `(type, id)` from two sources yields one atom and one value; unread records survive until scope disposal or `evict`. Errors: a hydrate failure is a typed `ParseError`, no partial write. | fn-58-effect-native-records-layer-in.1 | — |
| R2 | `ref` and `refs` update when either side's record changes, keep ids and order for missing targets, and never start a request on read. | fn-58-effect-native-records-layer-in.3, fn-58-effect-native-records-layer-in.9 | — |
| R3 | A field transformation hydrates on `find` and `push`, serializes on `commit`, supplies `defaultValue` for a new record, and is reusable across records; a failure in either direction is a typed `ParseError`. | fn-58-effect-native-records-layer-in.2 | — |
| R4 | `find` and `commit` work through the record's adapter Tag with no `query` installed; a missing adapter Layer is reported in `R`, and a fake Layer replaces it in a test; the same record works over two adapter Layers with different envelopes and PATCH shapes; `useRecord(Post, id)` returns the shared record as a `Result` (waiting on first load, success with the map's value, typed failure) and keeps showing the record during a refetch, with no `query` installed; a conditional `useRecord` call is reported by `sleekstack check`. | fn-58-effect-native-records-layer-in.4 | — |
| R5 | `commit` writes the saved record into the map; a failed save leaves the map and the Draft unchanged and returns typed failures; a Draft edited during the save keeps its edits; a record with no explicit `draft` section gets a derived Draft whose baseline moves to the acknowledged record (A, submit B, edit C, acknowledge B: B clean, A dirty); a conditional `record.useDraft(id)` call is reported by `sleekstack check`. | fn-58-effect-native-records-layer-in.5, fn-58-effect-native-records-layer-in.9 | — |
| R6 | `queryOf(Post).query(id)` caches, de-dupes and ingests results from a fetch, a cache hit and a hydrated state into the same atoms; a cache entry older than a committed save cannot overwrite the saved record; `useRecord(Post, id, { via: queryOf(Post) })` fetches through the Query Client with the same result states; entry `@sleekstack/model/query` is the only one that needs `query`, and the base entry loads none of it. | fn-58-effect-native-records-layer-in.6 | — |
| R7 | A Draft-only bundle holds no records code; the size budget test passes; `useDraft(spec, src)` and `DraftSpec.toDto` behave as before. | fn-58-effect-native-records-layer-in.7 | — |
| R8 | A new ADR supersedes ADR 0038's "Rejected" line on relationships and a record store and records the three-part split; CONTEXT.md defines the new terms (avoiding `Record` and `Entity`); the Models guide and the model README document it; AGENTS.md verify row for model still holds. | fn-58-effect-native-records-layer-in.8 | — |

