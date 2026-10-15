import { Effect } from 'effect'
import type { UserNotFound } from './errors'
import type { User } from './model'

export class UserRepo extends Effect.Tag('UserRepo')<
  UserRepo,
  {
    all(): Effect.Effect<ReadonlyArray<User>>
    get(id: string): Effect.Effect<User, UserNotFound>
  }
>() {}

/** Who is looking at the board; provided per subtree with `<Provider>`. */
export class Viewer extends Effect.Tag('Viewer')<Viewer, { readonly user: User }>() {}
