import { Effect, Equal, type ParseResult, Schema, type SchemaAST } from 'effect'
import { structuralRegion } from 'effect/Utils'

/**
 * What a transformation's factory returns for one set of options. `from` is the wire field, `to` the app value (its
 * Encoded is the input a Draft holds, its Type the value a record holds).
 *
 * - `hydrate(wire, ast)`: wire to app input, when wire data becomes a record (`push`).
 * - `serialize(input, ast)`: app input to wire, when Draft values become a change. `to` validates the input first, so
 *   bound it there (a length cap) before `serialize` converts it with `Number()`.
 * - `defaultValue()`: the app input for a field with no value (an `undefined` wire value, a new record's Draft).
 *
 * Both directions fail with a `ParseIssue` (`new ParseResult.Type(ast, value, message)`), surfaced as a `ParseError`.
 */
export interface TransformationParts<From extends Schema.Schema.Any, To extends Schema.Schema.Any> {
  readonly from: From
  readonly to: To
  readonly hydrate: (
    wire: Schema.Schema.Type<From>,
    ast: SchemaAST.Transformation,
  ) => Effect.Effect<Schema.Schema.Encoded<To>, ParseResult.ParseIssue>
  readonly serialize: (
    input: Schema.Schema.Encoded<To>,
    ast: SchemaAST.Transformation,
  ) => Effect.Effect<Schema.Schema.Type<From>, ParseResult.ParseIssue>
  readonly defaultValue: () => Schema.Schema.Encoded<To>
}

/** A field's Schema made by `field`: the app value as Type, the wire value (or `undefined`) as Encoded. */
export type TransformedField<From extends Schema.Schema.Any, To extends Schema.Schema.Any> = Schema.Schema<
  Schema.Schema.Type<To>,
  Schema.Schema.Encoded<From> | undefined,
  Schema.Schema.Context<From> | Schema.Schema.Context<To>
>

/** A per-field transformation made by `defineTransformation`, attached to a field with `field(transformation, options)`. */
export interface Transformation<N extends string, O, From extends Schema.Schema.Any, To extends Schema.Schema.Any> {
  readonly name: N
  /** The field Schema for `options`: the same Schema for structurally equal options. */
  readonly of: (options: O) => TransformedField<From, To>
}

/**
 * `defineTransformation(name, options => ({ from, to, hydrate, serialize, defaultValue }))`: a typed per-field
 * transformation, passed as a value (never looked up by name). It reads one field only: a value computed from other
 * fields is a derived atom, not a transformation.
 */
export const defineTransformation = <
  const N extends string,
  O,
  From extends Schema.Schema.Any,
  To extends Schema.Schema.Any,
>(
  name: N,
  make: (options: O) => TransformationParts<From, To>,
): Transformation<N, O, From, To> => {
  // ponytail: linear scan over the option sets seen; a hash map if a transformation sees many distinct option sets.
  const made: Array<readonly [O, TransformedField<From, To>]> = []
  const build = (options: O): TransformedField<From, To> => {
    const parts = make(options)
    return Schema.transformOrFail(Schema.UndefinedOr(parts.from), parts.to, {
      strict: false,
      decode: (wire, _, ast) =>
        wire === undefined ? Effect.succeed(parts.defaultValue()) : parts.hydrate(wire as never, ast),
      encode: (input, _, ast) => parts.serialize(input as never, ast),
    }).annotations({ title: name }) as unknown as TransformedField<From, To>
  }
  return {
    name,
    of: (options) => {
      // Plain options by structure, so a new options object per render is the same field (and the same Draft spec).
      const hit = made.find(([o]) => Object.is(o, options) || structuralRegion(() => Equal.equals(o, options)))
      if (hit) return hit[1]
      const schema = build(options)
      made.push([options, schema])
      return schema
    },
  }
}

/** `field(transformation, options)`: the Schema of a record field run through `transformation`. */
export const field = <N extends string, O, From extends Schema.Schema.Any, To extends Schema.Schema.Any>(
  transformation: Transformation<N, O, From, To>,
  ...[options]: undefined extends O ? [options?: O] : [options: O]
): TransformedField<From, To> => transformation.of(options as O)
