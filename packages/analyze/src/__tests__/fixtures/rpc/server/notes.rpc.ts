import { Data, Effect, Schema } from 'effect'
import { Boom } from '../errors.server'
import { Missing, type Note } from '../schemas'
import type { Db, Notes } from '../services'

export function list(): Effect.Effect<ReadonlyArray<string>> {
  return Effect.succeed([])
}
export const get = (id: string): Effect.Effect<string, Missing, Db> => Effect.fail(new Missing({ id }))
export const add = function (input: Schema.Schema.Type<typeof Note>): Effect.Effect<void> {
  return Effect.log(input)
}
export const rename = ({ id, text }: { readonly id: string; readonly text: string }): Effect.Effect<void> => Effect.log(id, text)
const remove = (id: number): Effect.Effect<void> => Effect.log(id)
export { remove as delete }
export const limit = 10
export const wrap = <A, E, R>(next: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => next

export const generic = <T extends string>(x: T): Effect.Effect<T> => Effect.succeed(x) // @error RpcMethodShape
export const later = async (x: string): Promise<string> => x // @error RpcMethodShape
export const traced = Effect.fn('traced')(function* (x: string) { return x }) // @error RpcMethodShape
export const untyped = (x: string) => Effect.succeed(x) // @error RpcMethodShape
export const loose = (x: any): Effect.Effect<void> => Effect.log(x) // @error RpcMethodShape
export const two = (a: string, b: string): Effect.Effect<void> => Effect.log(a, b) // @error RpcMethodShape
export const date = (): Effect.Effect<Date> => Effect.succeed(new Date()) // @error ServerServiceTypeNotSerializable
export const linked = (): Effect.Effect<void, never, Notes> => Effect.void // @error RpcMethodShape
export const boom = (): Effect.Effect<void, Boom> => Effect.void // @error ServerFileInClientGraph
export class Local extends Data.TaggedError('Local')<{ readonly at: string }> {}
export const local = (): Effect.Effect<void, Local> => Effect.void // @error ServerFileInClientGraph
export const Shape = Schema.Struct({ id: Schema.String })
export const shaped = (input: Schema.Schema.Type<typeof Shape>): Effect.Effect<void> => Effect.log(input) // @error ServerFileInClientGraph
