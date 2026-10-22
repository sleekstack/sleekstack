import { ServerService } from '@sleekstack/start/client'
import type { Effect } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../errors'
import type { Account, LoginUser, NewUser, Profile, UpdateUser } from '../domain/model'

interface ByUsername {
  readonly username: string
}

/**
 * The identity Server Service: the contract only. `server/identity-api.server.ts` implements it; register and login set
 * the session cookie, logout clears it, and every other method runs as the session cookie's viewer.
 */
export class IdentityApi extends ServerService('IdentityApi')<
  IdentityApi,
  {
    readonly register: (input: NewUser) => Effect.Effect<Account, ValidationError>
    readonly login: (input: LoginUser) => Effect.Effect<Account, ValidationError | Forbidden>
    readonly logout: () => Effect.Effect<void>
    readonly current: () => Effect.Effect<Account, Unauthorized>
    readonly update: (input: UpdateUser) => Effect.Effect<Account, ValidationError | Unauthorized>
    readonly profile: (input: ByUsername) => Effect.Effect<Profile, Unauthorized | NotFound>
    readonly follow: (input: ByUsername) => Effect.Effect<Profile, ValidationError | Unauthorized | NotFound>
    readonly unfollow: (input: ByUsername) => Effect.Effect<Profile, Unauthorized | NotFound>
  }
>() {}
