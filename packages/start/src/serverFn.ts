import type { NotFound, Redirect } from '@sleekstack/router'
import { Data, Effect, type Schema } from 'effect'
import type { ServerServiceEntry } from './service'
import type { YieldWrap } from 'effect/Utils'

export type AnySchema = Schema.Schema<any, any, never>

/** The declared error's type: `never` when the function declares none. */
export type ErrorOf<Err> = Err extends AnySchema ? Schema.Schema.Type<Err> : never

/**
 * A server function: its id, Schemas and body. Calling it runs the body with already-decoded input (no wire); `start`
 * serves it at `POST /_sleek/fn/<id>`.
 */
export interface ServerFn<
  Id extends string = string,
  In extends AnySchema = AnySchema,
  Out extends AnySchema = AnySchema,
  Err extends AnySchema | undefined = AnySchema | undefined,
  R = any,
> {
  (input: Schema.Schema.Type<In>): Effect.Effect<Schema.Schema.Type<Out>, ErrorOf<Err> | Redirect | NotFound, R>
  readonly id: Id
  readonly input: In
  readonly success: Out
  readonly error: Err
}

type Requirements<Eff> = [Eff] extends [never]
  ? never
  : [Eff] extends [YieldWrap<Effect.Effect<any, any, infer R>>]
    ? R
    : never

/**
 * Declares a server function. The body's failures are limited to the declared `error` and the router's `Redirect` /
 * `NotFound`; its services resolve in the Request Scope.
 *
 * @example
 * ```ts
 * import { serverFn } from '@sleekstack/start'
 * import { Effect, Schema } from 'effect'
 *
 * class NameTaken extends Schema.TaggedError<NameTaken>()('NameTaken', { name: Schema.String }) {}
 * class Profiles extends Effect.Service<Profiles>()('Profiles', {
 *   succeed: { rename: (name: string) => Effect.succeed({ name }) },
 * }) {}
 *
 * export const rename = serverFn('profile.rename', {
 *   input: Schema.Struct({ name: Schema.NonEmptyString }),
 *   success: Schema.Struct({ name: Schema.String }),
 *   error: NameTaken,
 * })(function* ({ name }) {
 *   const profiles = yield* Profiles
 *   return yield* profiles.rename(name)
 * })
 * ```
 */
export const serverFn =
  <const Id extends string, In extends AnySchema, Out extends AnySchema, Err extends AnySchema | undefined = undefined>(
    id: Id,
    schemas: { readonly input: In; readonly success: Out; readonly error?: Err },
  ) =>
  <Eff extends YieldWrap<Effect.Effect<any, ErrorOf<Err> | Redirect | NotFound, any>>>(
    body: (input: Schema.Schema.Type<In>) => Generator<Eff, Schema.Schema.Type<Out>, never>,
  ): ServerFn<Id, In, Out, Err, Requirements<Eff>> =>
    Object.assign((input: Schema.Schema.Type<In>) => Effect.gen(() => body(input)), {
      id,
      input: schemas.input,
      success: schemas.success,
      error: schemas.error as Err,
    }) as never

/** Two server functions given to `start` with one id. */
export class DuplicateServerFn extends Data.TaggedError('DuplicateServerFn')<{ readonly id: string }> {}
/** A server function id outside `[A-Za-z0-9][A-Za-z0-9_.-]*`, so it cannot be one path segment. */
export class InvalidServerFnId extends Data.TaggedError('InvalidServerFnId')<{ readonly id: string }> {}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

/** The functions by id; throws `InvalidServerFnId` or `DuplicateServerFn`. */
export const registry = (functions: ReadonlyArray<ServerFn>): ReadonlyMap<string, ServerFn> => {
  const byId = new Map<string, ServerFn>()
  for (const fn of functions) {
    if (!ID.test(fn.id)) throw new InvalidServerFnId({ id: fn.id })
    if (byId.has(fn.id)) throw new DuplicateServerFn({ id: fn.id })
    byId.set(fn.id, fn)
  }
  return byId
}

/** Each Server Service method as a server function `<Tag id>.<method>` that calls the Tag from the Request Scope. */
export const serviceFunctions = (entries: ReadonlyArray<ServerServiceEntry>): ReadonlyArray<ServerFn> =>
  entries.flatMap(({ tag, methods }) =>
    Object.entries(methods).map(([name, schemas]) => {
      // Each part must be a valid id on its own: `.bad` after `Demo.` would pass as the joined `Demo..bad`.
      for (const part of [tag.key, name]) if (!ID.test(part)) throw new InvalidServerFnId({ id: part })
      return Object.assign((input: unknown) => Effect.flatMap(tag, (service) => service[name](input)), {
        id: `${tag.key}.${name}`,
        input: schemas.input,
        success: schemas.success,
        error: schemas.error,
      })
    }),
  )
