# 0041. Records layer in `@sleekstack/model`: Record, Transformation, Adapter and Draft

## Status

Accepted. Supersedes the "relationships, and a record store as in EmberData" part of ADR 0038's Rejected section. Built in spec fn-58.

## Context

ADR 0038 gave `@sleekstack/model` a pure read direction (`ModelSpec.fromDto`) and an edit direction (`DraftSpec`, `useDraft`), and left relationships and record identity out of scope. Without them every view that shows one server record holds its own copy: a save in one view does not reach another, and a relationship is a hand-written lookup. EmberData and WarpDrive solve this with one record per type and id, relationships over it, and adapters that own the wire. The user ranked an Effect-native version of that above the earlier decision. The parts it needs already exist here: Effect Schema for fields, Atoms in the scope's Store for state, Services and Layers for the wire, and the Query Client (ADR 0018) for caching.

## Decision

The records layer has three parts with one job each, and a fourth it derives:

| Part                                                                                | Owns                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Record** (`defineRecord(type, { fields, adapter? })`)                             | Fields as Effect Schema, per-field transformations (`field`), relationships (`ref`, `refs`), and which adapter Tag loads and saves it |
| **Transformation** (`defineTransformation(name, options => parts)`)                 | One field's wire format: `from`, `to`, `hydrate`, `serialize`, `defaultValue`                                                         |
| **Adapter** (an app-written `Effect.Tag` of a `RecordAdapter`, supplied as a Layer) | The wire contract: envelope, request body, PATCH shape                                                                                |
| **Draft** (`record.useDraft(id)`)                                                   | Input validation, `dirty`, `reset`, `errors`, typed change values                                                                     |

- **Identity map.** One slot per `(type, id)` in each Store, held by one `keepAlive` registry atom, so every `push` of a type and id writes the same slot and `record.atom(id)` reads it. A record stays until the Store is disposed or `record.evict(id)`, read or not; `evict` empties the slot and keeps the atom. State never lives in `Atom.family` (weak references can split identity); a stateless reader atom per `(type, id)` is shared across definitions. Ids are strings.
- **Ingest.** `record.push(wire)` decodes with the fields' Schemas (running each `hydrate`) and replaces the whole record; a `ParseError` writes nothing. Its Store is a Service in `R`, since `effectFn` does not inherit a component's Store. Only complete records with server ids.
- **Transformations are values.** `defineTransformation(name, options => ({ from, to, hydrate, serialize, defaultValue }))` returns a typed factory; `field(Money, { currency })` attaches it. `hydrate` runs when wire data becomes a record, `serialize` when a Draft becomes a change, `defaultValue` for a missing wire value or a new record's Draft. Both directions fail with a typed `ParseError`. A transformation reads one field; a value computed from several fields is a derived atom. Structurally equal options give the same field Schema.
- **The Adapter owns the wire.** `RecordAdapter<W, C, E>` has `find(id)` and `save(id, change)`, Effects that return the record's wire form with the envelope removed and fail in `E`. The package defines the shape, not the Tags: the app declares one Tag per record type and supplies a Layer, so a missing adapter shows in `R` (and in `sleekstack check`), a test swaps in a fake Layer, and REST or GraphQL differ only in the Layer. A record without an adapter has `push`, `atom`, `evict`, `related` and `useDraft`, but no `find` or `commit`.
- **Relationships are derived atoms.** `ref(() => Target)` (to-one, wire `string | null`) and `refs(() => Target)` (to-many, wire `string[]`) are fields; `record.related(id, field)` is one stable atom per id and field holding `RecordRef { id, value: Option }` entries. It follows the owner and every target in the map and never fetches. A missing target keeps its id and position; order is the server's. No inverse sync: one side is authoritative.
- **`find` and `useRecord` need no query.** `record.find(id)` is the adapter's `find`, then `hydrate`, then a write into the map; concurrent calls for one id in a Store share one adapter call, and the Store's scope owns the fiber, so disposing it interrupts the call and writes nothing. `useRecord(record, id, options?)` is a slot hook that reads the map and fetches once while the slot is empty, returning a `Result`: waiting on first load, success with the map's value (kept during a refetch), typed failure. `options.via` takes a `FetchStrategy`.
- **`commit` is pessimistic.** `record.commit(id, draft)` validates the Draft (a `ParseError` before any `serialize`), serializes it to a `RecordChange`, calls the adapter's `save`, and writes the hydrated response into the map as the acknowledged value. A failure writes nothing and leaves the Draft as it is; a response that does not hydrate or is another record is `SaveResponseError`; a second commit of the record while one is saving is `SaveInFlight`. No optimistic shared write until rollback can remove only its own change.
- **Acknowledgement ordering.** Each slot keeps the time of its last acknowledged save. A `find` response is dropped when a save was acknowledged after its request started, and a query cache entry (or a hydrated one) is dropped unless its `dataUpdatedAt` is strictly newer than that acknowledgement. An older fetch never overwrites a newer save.
- **The Draft is derived from the record.** `record.useDraft(id)` is `useDraft` over a derived Draft Spec: every field but `id` in input form (a date as its string, a `field(...)` as its `to` input), seeded from the map or from each `defaultValue` while the record is missing. The Draft and the record stay two objects; an edit never touches the shared record. A pristine Draft re-seeds from the new record; an edited one keeps its edits and moves its baseline to the acknowledged record (value A, submit B, edit to C, acknowledge B: B reads clean, A dirty). Standalone `useDraft(spec, src)` and `DraftSpec.toDto` are unchanged; for records the wire body is the adapter's job.
- **Query is an optional entry.** `@sleekstack/model/query` exports `queryOf(record)`: `query(id)` reads the Query Client entry `[type, id]` with `effectFn` (caching, de-duping, stale handling), and every read, a cache hit and a hydrated entry included, writes into the map. After a commit the acknowledged wire is written into the entry. It is also a `FetchStrategy`: `useRecord(record, id, { via: queryOf(record) })`. The Query Client Layer must be given the app's Store and the adapter Layer. The base entry never imports `@sleekstack/query`, which is an optional peer.
- **The map is client-only.** No record atom is `serializable`; after SSR the map rebuilds from the hydrated Query cache through `queryOf(record).query`.
- **The Analyzer** treats `useRecord` and `record.useDraft` as slot hooks by their declarations, so a conditional call is `ConditionalSlot`.

## Consequences

- One package keeps the whole Model, Draft and record feature, and a Draft-only bundle holds no records code (`sideEffects: false`, guarded by a bundle test). ADR 0022's table has the measured row for a records entry.
- An app writes one adapter Tag and Layer per record type. Envelope, request body and PATCH shape live there and nowhere else.
- New public names: `defineRecord`, `defineTransformation`, `field`, `ref`, `refs`, `useRecord`, `queryOf`, `SaveInFlight`, `SaveResponseError`, and the types `RecordDefinition`, `AdaptedRecord`, `RecordFields`, `RelationKey`, `RecordRef`, `Related`, `RefField`, `RefsField`, `RelationTarget`, `Transformation`, `TransformationParts`, `TransformedField`, `RecordAdapter`, `AdapterTag`, `FetchStrategy`, `FindError`, `SaveError`, `RecordDraft`, `RecordInput`, `RecordChange`, `RecordQuery`. None is `Record`, `Entity` or `Ref`.
- Not in v1: inverse sync, optimistic shared writes, partial records, unknown relationship membership, pagination, polymorphism, an HTTP client or a JSON:API format.
- A record type that refers to itself, or two that refer to each other, needs one definition annotated with its type, as TypeScript cannot infer the cycle.

## Rejected

- **A separate `@sleekstack/records` package, or not building it (the model panel's advice):** the user chose to enrich `model`; tree-shaking keeps the cost out of Draft-only bundles.
- **A store with its own fetching and cache:** a second cache beside the Query Client. `find` de-dupes only in-flight calls; caching is `queryOf`'s.
- **The adapter wired inside each query:** fetching would need TanStack; on the record, `find` and `commit` work without it.
- **Records as `Atom.family` keyed by id:** identity is type and id, and weak references could drop state.
- **One object for the record and its edit:** edits would leak into every view of the record.
- **A whole-record two-way codec:** the read and write shapes differ (ADR 0038).
- **A string registry of transformations:** types would not flow from definition to field.
- **Built-in transformations for what Effect Schema covers** (dates, numbers from strings).
- **The names `Record`, `Entity` and `Ref`:** they clash with TypeScript's `Record`, Effect's `Record` and `Ref`, and CONTEXT.md's `_Avoid_` list.
