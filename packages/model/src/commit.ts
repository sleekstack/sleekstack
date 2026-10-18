import { Atom, Result } from '@sleekstack/core'
import { Store } from '@sleekstack/ui/internal'
import { type Context, Data, Effect, Either, Fiber, Option, ParseResult, Schema, SchemaAST, type Scope } from 'effect'
import { type AdapterTag, stamp } from './adapter'
import { type Draft, FOLLOWS } from './draft'
import type { DraftSpec } from './model'
import { slotOf } from './registry'
import type { TransformedField } from './transformation'

/** A second `commit` of one record while its first is still saving. */
export class SaveInFlight extends Data.TaggedError('SaveInFlight')<{ readonly type: string; readonly id: string }> {}

/**
 * The adapter's `save` succeeded, but its response did not hydrate or is another record: the map and the Draft are
 * unchanged.
 */
export class SaveResponseError extends Data.TaggedError('SaveResponseError')<{
  readonly type: string
  readonly id: string
  readonly cause: ParseResult.ParseError
}> {}

/** The failure of the adapter's `save`. */
export type SaveError<Ad extends AdapterTag> = Effect.Effect.Error<ReturnType<Context.Tag.Service<Ad>['save']>>

type Editable<F> = Omit<F, 'id'>
// A `field(...)` Schema (its wire may be `undefined`): the Draft holds its `to` input.
type InputFields<F> = {
  [K in keyof Editable<F>]: F[K] extends TransformedField<any, infer To>
    ? undefined extends Schema.Schema.Encoded<F[K]>
      ? Schema.Schema<Schema.Schema.Encoded<To>, Schema.Schema.Encoded<To>, Schema.Schema.Context<To>>
      : F[K]
    : F[K]
}
/** What a record's derived Draft holds: every field but `id`, in its input (Encoded) form; a date holds its string. */
export type RecordInput<F extends Schema.Struct.Fields> = Schema.Struct.Encoded<InputFields<F>>
/** What `commit` sends to the adapter's `save`: every field but `id`, serialized to its wire form. */
export type RecordChange<F extends Schema.Struct.Fields> = Schema.Struct.Encoded<Editable<F>>
/** The Draft of a record (`record.useDraft(id)`): its `toDto()` validates and serializes it to a `RecordChange`. */
export type RecordDraft<F extends Schema.Struct.Fields> = Draft<
  RecordInput<F>,
  RecordChange<F>,
  never,
  never,
  Schema.Struct.Context<F>
>

// A `field(transformation, options)` Schema: a transformation from `UndefinedOr(from)` to `to`.
const transformedTo = (s: unknown): Schema.Schema.Any | undefined => {
  if (!Schema.isSchema(s) || !SchemaAST.isTransformation(s.ast)) return undefined
  const from = s.ast.from
  return SchemaAST.isUnion(from) && from.types.some(SchemaAST.isUndefinedKeyword) ? Schema.make(s.ast.to) : undefined
}

/**
 * The derived Draft Spec of a record's fields. The Draft holds each field but `id` in its input form (a transformed
 * field its `to` input, any other field its Encoded form), validated by the fields' Schemas. Its `toDto` decodes the
 * Draft (so a transformed field's `to` checks the input before `serialize`) and encodes it to the wire change. Its
 * seed follows the record: an edited Draft keeps its edits and measures `dirty` against the newest record.
 */
export const derivedSpec = (fields: Schema.Struct.Fields): DraftSpec<any, any, Option.Option<any>, never, any, any> => {
  const editable = Object.fromEntries(Object.entries(fields).filter(([k]) => k !== 'id'))
  const inputs = Object.fromEntries(Object.entries(editable).map(([k, f]) => [k, transformedTo(f) ?? f]))
  const input = Schema.Struct(inputs) as unknown as Schema.Schema<any, any>
  const change = Schema.Struct(editable) as unknown as Schema.Schema<any, any>
  const form = Schema.encodedSchema(input)
  // Type and Encoded are both the input form, so the Draft's equivalence compares inputs; decoding checks the fields.
  const schema = Schema.transformOrFail(form, form, {
    strict: true,
    decode: (d, options) => ParseResult.map(ParseResult.decodeUnknown(input)(d, options), () => d),
    encode: ParseResult.succeed,
  })
  // A create form (no record yet): a field that decodes from no value (a transformation's `defaultValue`), else
  // `undefined` until it is filled.
  const blank = () =>
    Object.fromEntries(
      Object.entries(inputs).map(([k, i]) => {
        const f = editable[k]
        const typed = Schema.isSchema(f)
          ? Schema.decodeUnknownEither(f as Schema.Schema<any, any>)(undefined)
          : undefined
        return [
          k,
          typed && Either.isRight(typed) ? Schema.encodeSync(i as Schema.Schema<any, any>)(typed.right) : undefined,
        ]
      }),
    )
  return {
    [FOLLOWS]: true,
    schema: () => schema,
    create: (record: Option.Option<unknown>) =>
      Option.match(record, { onNone: blank, onSome: (r) => Schema.encodeSync(input)(r) }),
    toDto: (d: unknown) => Effect.flatMap(Schema.decodeUnknown(input)(d), Schema.encode(change)),
  } as unknown as DraftSpec<any, any, Option.Option<any>, never, any, any>
}

// One per Store: the records being saved, and a scope owning the saves, so disposing the Store interrupts them.
interface Saving {
  readonly ids: Set<string>
  readonly scope: Scope.Scope
}
const saving = Atom.keepAlive(Atom.make(Effect.map(Effect.scope, (scope): Saving => ({ ids: new Set(), scope }))))

/**
 * The `commit` of record type `type`: the Draft's `toDto()` (validate, then `serialize`), the adapter's `save`, then
 * `decode` of its response, written into the map with the slot's `ackedAt`. A failure at any step writes nothing.
 */
export const commitOf =
  <A, R>(type: string, adapter: AdapterTag, decode: (wire: unknown) => Effect.Effect<A, ParseResult.ParseError, R>) =>
  (id: string, draft: Draft<any, any, never, any, any>): Effect.Effect<A, any, any> =>
    Effect.flatMap(Store, (s) => {
      const built = s.get(saving)
      if (!Result.isSuccess(built)) return Effect.dieMessage(`commit('${id}') of '${type}' needs a live Store`)
      const { ids, scope } = built.value
      const key = JSON.stringify([type, id])
      if (ids.has(key)) return Effect.fail(new SaveInFlight({ type, id }))
      ids.add(key)
      const work = draft.toDto().pipe(
        Effect.flatMap((change) => Effect.flatMap(adapter, (a) => a.save(id, change))),
        Effect.flatMap((wire) =>
          decode(wire).pipe(
            Effect.filterOrFail(
              (record) => (record as { readonly id: string }).id === id,
              () =>
                new ParseResult.ParseError({
                  issue: new ParseResult.Type(Schema.Literal(id).ast, wire, `expected the saved record '${id}'`),
                }),
            ),
            Effect.mapError((cause) => new SaveResponseError({ type, id, cause })),
          ),
        ),
        Effect.map((record) => {
          s.update(slotOf(s, type, id), () => ({ value: Option.some(record), ackedAt: Option.some(stamp()) }))
          return record
        }),
        Effect.ensuring(Effect.sync(() => ids.delete(key))),
      )
      return Effect.flatMap(Effect.forkIn(work, scope), Fiber.join)
    })
