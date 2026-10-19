import type { Atom } from '@sleekstack/core'
import { Store } from '@sleekstack/ui/internal'
import { type Context, Effect, Option, type ParseResult, Schema } from 'effect'
import { type AdapterTag, type FindError, findOf, ingest, type RecordAdapter } from './adapter'
import {
  commitOf,
  derivedSpec,
  type RecordDraft,
  type SaveError,
  type SaveInFlight,
  type SaveResponseError,
} from './commit'
import { useDraft } from './draft'
import { recordAtom, remember, slotOf } from './registry'
import { type Related, type RefField, type RefsField, relatedOf } from './relations'

/** What `defineRecord` takes: Effect Schema fields, with a string `id`. */
export type RecordFields = Schema.Struct.Fields & { readonly id: Schema.Schema<string, any, any> }

/** A record type made by `defineRecord`: one shared value per id in each Store. */
export interface RecordDefinition<T extends string, F extends RecordFields> {
  readonly type: T
  readonly schema: Schema.Struct<F>
  /** The record of `id` in the reading Store, `None` until pushed or after `evict`; the same atom for an id on every call. */
  readonly atom: (id: string) => Atom.Atom<Option.Option<Schema.Schema.Type<Schema.Struct<F>>>>
  /** Decodes `wire` with the fields' Schema and replaces the record of its id; a failure writes nothing. */
  readonly push: (
    wire: Schema.Struct.Encoded<F>,
  ) => Effect.Effect<Schema.Schema.Type<Schema.Struct<F>>, ParseResult.ParseError, Store | Schema.Struct.Context<F>>
  /** Empties the record of `id`; its atom stays, and a later `push` fills it again. */
  readonly evict: (id: string) => Effect.Effect<void, never, Store>
  /**
   * The relationship `field` (a `ref` or `refs` field) of the record `id`: the same atom for an id and field on every
   * call. It follows the owner and every target in the map and never fetches; a missing target keeps its id and
   * position with a `None` value. `None` while the owner is not in the map. One direction only: a reverse view built
   * from it covers loaded records only.
   */
  readonly related: <K extends RelationKey<F>>(id: string, field: K) => Atom.Atom<Option.Option<Related<F[K]>>>
  /**
   * The Draft of the record `id`: every field but `id`, in its input form (a date holds its string, a `field(...)` its
   * `to` input), validated by the fields' Schemas, seeded from the map (a transformation's `defaultValue` while the
   * record is missing). When the record changes, a pristine Draft re-seeds; an edited one keeps its edits and measures
   * `dirty` against the new record. Takes a slot like `useDraft`, so call it unconditionally. Only for fields whose
   * Schemas need no Service (the Draft seeds and validates synchronously); otherwise it is `never`.
   */
  readonly useDraft: [Schema.Struct.Context<F>] extends [never]
    ? (id: string) => Effect.Effect<RecordDraft<F>, never, Store>
    : never
}

/**
 * A record type with an adapter (`defineRecord(type, { fields, adapter })`): it also loads records through the
 * adapter's Service, which a Layer supplies, so a missing adapter Layer shows in `R`.
 */
export interface AdaptedRecord<
  T extends string,
  F extends RecordFields,
  Ad extends AdapterTag,
> extends RecordDefinition<T, F> {
  readonly adapter: Ad
  /**
   * The adapter's `find(id)`, then the fields' `hydrate`, then a write into the map, unless a save of the record was
   * acknowledged after the request started (the older response is dropped). Concurrent calls for one id in a Store
   * share one adapter call; a failed call is not reused. Disposing the Store interrupts it and writes nothing.
   */
  readonly find: (
    id: string,
  ) => Effect.Effect<
    Schema.Schema.Type<Schema.Struct<F>>,
    FindError<Ad> | ParseResult.ParseError,
    Store | Context.Tag.Identifier<Ad> | Schema.Struct.Context<F>
  >
  /**
   * Saves `draft` as the record `id`: validates it (a `ParseError` before any `serialize`), serializes it to a change,
   * sends it with the adapter's `save`, and writes the hydrated response (which must be the record `id`) into the map as the record's acknowledged
   * value. Pessimistic: nothing is written before the acknowledgement, and a failure writes nothing and leaves the
   * Draft as it is (`SaveResponseError` when the save succeeded but its response did not hydrate). A second commit of
   * the record while one is saving fails with `SaveInFlight`. Disposing the Store interrupts it.
   */
  readonly commit: (
    id: string,
    draft: RecordDraft<F>,
  ) => Effect.Effect<
    Schema.Schema.Type<Schema.Struct<F>>,
    SaveError<Ad> | ParseResult.ParseError | SaveInFlight | SaveResponseError,
    Store | Context.Tag.Identifier<Ad> | Schema.Struct.Context<F>
  >
}

/** The keys of `F` that are `ref` or `refs` fields. */
export type RelationKey<F> = {
  [K in keyof F]: F[K] extends RefField<any> | RefsField<any> ? K : never
}[keyof F] &
  string

/**
 * `defineRecord(type, { fields, adapter? })`: a record type. Every `push` of one type and id, from any source, writes
 * the same slot of the Store's identity map, and `atom(id)` reads it. A pushed record stays until the Store is disposed
 * or `evict(id)`, whether or not anything reads it. `adapter` is the app's Tag of a `RecordAdapter` Service: the record
 * then has `find`. Declare the Tag once at module level; never make one per call.
 */
export function defineRecord<
  const T extends string,
  F extends RecordFields,
  Ad extends Context.Tag<any, RecordAdapter<Schema.Struct.Encoded<F>>>,
>(type: T, def: { readonly fields: F; readonly adapter: Ad }): AdaptedRecord<T, F, Ad>
export function defineRecord<const T extends string, F extends RecordFields>(
  type: T,
  def: { readonly fields: F },
): RecordDefinition<T, F>
export function defineRecord<const T extends string, F extends RecordFields>(
  type: T,
  def: { readonly fields: F; readonly adapter?: AdapterTag },
): RecordDefinition<T, F> {
  type A = Schema.Schema.Type<Schema.Struct<F>>
  const schema = Schema.Struct(def.fields)
  const decodeRaw = Schema.decodeUnknown(schema)
  const decode = (wire: unknown) => Effect.tap(decodeRaw(wire), (record) => Effect.sync(() => remember(record, wire)))
  const related = relatedOf(type, def.fields)
  const draftSpec = derivedSpec(def.fields)
  const idOf = (record: A) => (record as unknown as { readonly id: string }).id
  const base: RecordDefinition<T, F> = {
    type,
    schema,
    atom: (id) => recordAtom(type, id) as Atom.Atom<Option.Option<A>>,
    push: (wire) =>
      Effect.flatMap(decode(wire), (record) => Effect.map(Store, (s) => ingest(s, type, idOf(record), record))),
    evict: (id) =>
      Effect.map(Store, (s) => s.update(slotOf(s, type, id), (slot) => ({ ...slot, value: Option.none() }))),
    related: (id, field) => related(id, field) as never,
    useDraft: ((id: string) => useDraft(draftSpec as never, recordAtom(type, id) as never)) as never,
  }
  return def.adapter
    ? Object.assign(base, {
        adapter: def.adapter,
        find: findOf(type, def.adapter, decode),
        commit: commitOf(type, def.adapter, decode),
      })
    : base
}
