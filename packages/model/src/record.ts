import type { Atom } from '@sleekstack/core'
import { Store } from '@sleekstack/ui/internal'
import { Effect, Option, type ParseResult, Schema } from 'effect'
import { recordAtom, slotOf } from './registry'

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
}

/**
 * `defineRecord(type, { fields })`: a record type. Every `push` of one type and id, from any source, writes the same
 * slot of the Store's identity map, and `atom(id)` reads it. A pushed record stays until the Store is disposed or
 * `evict(id)`, whether or not anything reads it.
 */
export const defineRecord = <const T extends string, F extends RecordFields>(
  type: T,
  def: { readonly fields: F },
): RecordDefinition<T, F> => {
  type A = Schema.Schema.Type<Schema.Struct<F>>
  const schema = Schema.Struct(def.fields)
  const decode = Schema.decodeUnknown(schema)
  return {
    type,
    schema,
    atom: (id) => recordAtom(type, id) as Atom.Atom<Option.Option<A>>,
    push: (wire) =>
      Effect.flatMap(decode(wire), (record) =>
        Effect.map(Store, (s) => {
          s.update(slotOf(s, type, (record as unknown as { readonly id: string }).id), (slot) => ({
            ...slot,
            value: Option.some(record),
          }))
          return record
        }),
      ),
    evict: (id) =>
      Effect.map(Store, (s) => s.update(slotOf(s, type, id), (slot) => ({ ...slot, value: Option.none() }))),
  }
}
