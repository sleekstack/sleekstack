import type { NotFound, Redirect } from '@sleekstack/router'
import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'
import { Missing } from './errors'

interface Named { readonly name: string }
type Tagged = Named & { readonly tags: readonly string[] }
export class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string; readonly at?: number }> {}

export class Kinds extends ServerService('Kinds')<
  Kinds,
  {
    readonly primitives: (input: { s: string; n: number; b: boolean; z: null; u: undefined }) => Effect.Effect<void>
    readonly literals: (input: 'a' | 1 | true) => Effect.Effect<undefined>
    readonly unions: (input: string | number | boolean | null) => Effect.Effect<void>
    readonly arrays: (input: readonly number[]) => Effect.Effect<string[]>
    readonly optional: (input: { readonly name?: string }) => Effect.Effect<void>
    readonly nested: (input: Tagged) => Effect.Effect<{ readonly owner: Named }>
    readonly voidInput: () => Effect.Effect<void>
    readonly errors: () => Effect.Effect<void, NameTaken | Missing | Redirect | NotFound>
  }
>() {}
