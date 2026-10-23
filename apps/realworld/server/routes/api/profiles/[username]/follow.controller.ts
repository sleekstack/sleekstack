import { Effect, type Schema } from 'effect'
import type { NotFound, Unauthorized, ValidationError } from '../../../../../src/errors'
import type { Profile, Viewer } from '../../../../../src/modules/identity'
import type { Db } from '../../../../db'
import { follow, unfollow } from '../../../../identity'

type Input = { readonly params: { readonly username: string } }
type Answer = { readonly profile: Schema.Schema.Type<typeof Profile> }

/** The viewer follows `username`; following yourself is 422. */
export const POST = (input: Input): Effect.Effect<Answer, Unauthorized | NotFound | ValidationError, Db | Viewer> =>
  Effect.map(follow(input.params.username), (profile) => ({ profile }))

/** The viewer unfollows `username`. */
export const DELETE = (input: Input): Effect.Effect<Answer, Unauthorized | NotFound, Db | Viewer> =>
  Effect.map(unfollow(input.params.username), (profile) => ({ profile }))
