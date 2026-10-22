import { ServerService } from '@sleekstack/start/client'
import type { Effect, Schema } from 'effect'
import type Choice from './choice'
import type { Name, User } from './schemas'

type Body = Schema.Schema.Type<typeof User>
type Owned = { readonly owner: Body }

export class Refs extends ServerService('Refs')<
  Refs,
  {
    readonly inline: (input: Schema.Schema.Type<typeof User>) => Effect.Effect<Schema.Schema.Type<typeof Name>>
    readonly alias: (input: Body) => Effect.Effect<Owned>
    readonly nested: (input: {
      readonly names: ReadonlyArray<Schema.Schema.Type<typeof Name>>
      readonly tags?: readonly Schema.Schema.Type<typeof Name>[]
      readonly pick: Schema.Schema.Type<typeof Choice> | null
    }) => Effect.Effect<void>
  }
>() {}
