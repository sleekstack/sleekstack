import { Effect, type Schema } from 'effect'
import type { Count, Nested } from '../../../schemas'

export const GET = (input: { readonly params: { readonly uid: string } }): Effect.Effect<void> => Effect.log(input) // @error ControllerParamsMismatch
export const PATCH = (input: { readonly params: { readonly id: string; readonly extra: string } }): Effect.Effect<void> => Effect.log(input) // @error ControllerParamsMismatch
export const DELETE = (): Effect.Effect<void> => Effect.void // @error ControllerParamsMismatch
export const PUT = (input: { readonly params: { readonly id: Schema.Schema.Type<typeof Count> } }): Effect.Effect<void> => Effect.log(input) // @error ControllerMethodShape
export const POST = (input: { readonly params: Schema.Schema.Type<typeof Nested> }): Effect.Effect<void> => Effect.log(input) // @error ControllerMethodShape
