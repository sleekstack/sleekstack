import { Atom } from '@sleekstack/core'
import { Option, Schema } from 'effect'
import { recordAtom } from './registry'

/** A record type a relationship points at: only its `type` and `schema` are read, and only when the relationship is. */
export interface RelationTarget {
  readonly type: string
  readonly schema: Schema.Schema.Any
}

/** One relationship entry: the target's id as the owner holds it, and the target record, `None` until it is pushed. */
export interface RecordRef<A> {
  readonly id: string
  readonly value: Option.Option<A>
}

/** A to-one relationship field made by `ref`: the wire and the record hold the target's id, or `null`. */
export interface RefField<D extends RelationTarget> extends Schema.NullOr<typeof Schema.String> {
  readonly target: () => D
}

/** A to-many relationship field made by `refs`: the wire and the record hold the targets' ids, in the server's order. */
export interface RefsField<D extends RelationTarget> extends Schema.Array$<typeof Schema.String> {
  readonly target: () => D
}

/** What a relationship field's `related` atom holds: `RecordRef` or `null` for `ref`, a list of them for `refs`. */
export type Related<F> =
  F extends RefField<infer D>
    ? RecordRef<Schema.Schema.Type<D['schema']>> | null
    : F extends RefsField<infer D>
      ? ReadonlyArray<RecordRef<Schema.Schema.Type<D['schema']>>>
      : never

/**
 * `ref(() => Other)`: a to-one relationship field. The target is a thunk, so two records may point at each other; it is
 * called only when the relationship is read. For a cycle, spell out one side's fields as a type and annotate its
 * definition (`const Post: RecordDefinition<'post', PostFields> = defineRecord(...)`), as TypeScript cannot infer it.
 */
export const ref = <D extends RelationTarget>(target: () => D): RefField<D> =>
  Object.assign(Schema.NullOr(Schema.String), { target })

/** `refs(() => Other)`: a to-many relationship field. Ids keep their order, duplicates and missing targets. */
export const refs = <D extends RelationTarget>(target: () => D): RefsField<D> =>
  Object.assign(Schema.Array(Schema.String), { target })

const isRelation = (u: unknown): u is RefField<RelationTarget> | RefsField<RelationTarget> =>
  Schema.isSchema(u) && typeof (u as { target?: unknown }).target === 'function'

/**
 * The relationship atoms of one record type: `related(id, field)` reads the owner's record, then each target's record,
 * so a change to either, or a late `push` of a missing target, re-runs it. It never fetches. `None` while the owner
 * is not in the map.
 */
export const relatedOf = (type: string, fields: Schema.Struct.Fields) => {
  const family = Atom.family((key: string) => {
    const [id, name] = JSON.parse(key) as [string, string]
    const rel = fields[name]
    if (!isRelation(rel)) throw new TypeError(`'${name}' is not a ref or refs field of record type '${type}'`)
    // `Atom.make` would run an `Option` as an Effect; `writable` returns it as the value. Typed read-only.
    return Atom.writable<Option.Option<unknown>, never>(
      (get) =>
        Option.map(get(recordAtom(type, id)), (owner) => {
          const ids = (owner as Record<string, unknown>)[name] as string | null | ReadonlyArray<string>
          const target = rel.target().type
          const entry = (rid: string): RecordRef<unknown> => ({ id: rid, value: get(recordAtom(target, rid)) })
          return ids === null ? null : typeof ids === 'string' ? entry(ids) : ids.map(entry)
        }),
      () => {},
    )
  })
  return (id: string, name: string): Atom.Atom<Option.Option<unknown>> => family(JSON.stringify([id, name]))
}
