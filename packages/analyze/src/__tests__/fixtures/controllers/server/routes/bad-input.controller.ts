import { Effect, type Schema } from 'effect'
import type { Input } from '../../schemas'

export const POST = (input: { readonly foo: string }): Effect.Effect<void> => Effect.log(input) // @error ControllerMethodShape
export const GET = (input: { readonly body: { readonly x: string } }): Effect.Effect<void> => Effect.log(input) // @error ControllerMethodShape
export const PUT = (input: Schema.Schema.Type<typeof Input>): Effect.Effect<void> => Effect.log(input) // @error ControllerMethodShape
export const PATCH = (input: { readonly body: { readonly at: Date } }): Effect.Effect<void> => Effect.log(input) // @error ServerServiceTypeNotSerializable
export const DELETE = (input: { readonly body: string }, extra: string): Effect.Effect<void> => Effect.log(input, extra) // @error ControllerMethodShape
export const OPTIONS = (input: { readonly query: { readonly n: { readonly x: string } } }): Effect.Effect<void> => Effect.log(input) // @error ControllerMethodShape
export const HEAD = Effect.void // @error ControllerMethodShape
