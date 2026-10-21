import { Context, type Effect, Schema } from 'effect'
import type { NetworkError } from './client'
import type { DecodeError } from './wire'

type AnySchema = Schema.Schema<any, any, never>

/** A Server Service contract: methods taking at most one input and needing no services. */
export type ServerServiceMethods = {
  readonly [name: string]: (input: any) => Effect.Effect<any, any, never>
}

/** The Tag's service type: each contract method with `NetworkError | DecodeError` added, so both environments agree. */
export type ServerServiceShape<Shape extends ServerServiceMethods> = {
  readonly [K in keyof Shape]: Shape[K] extends (...input: infer In) => Effect.Effect<infer Out, infer Err, never>
    ? (...input: In) => Effect.Effect<Out, Err | NetworkError | DecodeError>
    : never
}

/**
 * Declares a Server Service: a Context Tag whose methods are Effect signatures. Implement it with a Layer in a
 * `*.server.ts` file; the generated client and registry serve each method at `POST /_sleek/fn/<id>.<method>`.
 *
 * @example
 * ```ts
 * import { ServerService } from '@sleekstack/start/client'
 * import { Data, type Effect } from 'effect'
 *
 * export class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}
 * export class Profiles extends ServerService('Profiles')<
 *   Profiles,
 *   { readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken> }
 * >() {}
 * ```
 */
export const ServerService =
  <const Id extends string>(id: Id) =>
  <Self, Shape extends ServerServiceMethods>() =>
    Context.Tag(id)<Self, ServerServiceShape<Shape>>()

/** One method's Schemas, as the generated registry writes them. */
export interface ServerServiceMethodSchemas {
  readonly input: AnySchema
  readonly success: AnySchema
  readonly error?: AnySchema | undefined
}

/** A registry entry: the Tag and one set of Schemas per method, given to `start({ services })`. */
export interface ServerServiceEntry<Id = any, Service = any> {
  readonly tag: Context.Tag<Id, Service>
  readonly methods: { readonly [K in keyof Service]: ServerServiceMethodSchemas }
}

/**
 * A Schema for a `Data.TaggedError` subclass: on the wire `_tag` plus `fields`, decoded back into the class. `Schema.is`
 * is an instance check, so a plain object with the same `_tag` is not the error.
 */
export const taggedError = <A extends { readonly _tag: string }, Fields extends Schema.Struct.Fields>(
  Class: new (args: any) => A,
  fields: Fields,
): Schema.Schema<A, Schema.Struct.Encoded<Fields> & { readonly _tag: string }, Schema.Struct.Context<Fields>> => {
  // `Data.TaggedError(tag)` names its prototype after the tag.
  const tag: string = Class.prototype.name
  return Schema.transform(Schema.Struct({ _tag: Schema.Literal(tag), ...fields }), Schema.instanceOf(Class), {
    strict: false,
    decode: (args) => new Class(args),
    encode: (error) => ({ ...error }),
  }) as never
}
