import { ServerService } from '@sleekstack/start/client'
import type { Effect, Schema } from 'effect'
import type * as Schemas from './schemas'
import type { Declared, Hidden, NotSchema, User } from './schemas'
import type { Secret } from './secret.server' // @error ServerServiceFileShape

type Wrap<T> = { readonly value: T }

export class Bad extends ServerService('Bad')<
  Bad,
  {
    readonly typeOnly: (input: Schema.Schema.Type<typeof Hidden>) => Effect.Effect<void> // @error ServerServiceMethodShape
    readonly serverOnly: (input: Schema.Schema.Type<typeof Secret>) => Effect.Effect<void> // @error ServerServiceMethodShape
    readonly declared: (input: Schema.Schema.Type<typeof Declared>) => Effect.Effect<void> // @error ServerServiceMethodShape
    readonly notSchema: () => Effect.Effect<Schema.Schema.Type<typeof NotSchema>> // @error ServerServiceMethodShape
    readonly qualified: (input: Schema.Schema.Type<typeof Schemas.User>) => Effect.Effect<void> // @error ServerServiceMethodShape
    readonly generic: (input: Wrap<Schema.Schema.Type<typeof User>>) => Effect.Effect<void> // @error ServerServiceMethodShape
  }
>() {}
