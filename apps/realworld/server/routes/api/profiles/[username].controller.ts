import { Effect, type Schema } from 'effect'
import type { NotFound } from '../../../../src/errors'
import type { Profile, Viewer } from '../../../../src/modules/identity'
import type { Db } from '../../../db'
import { profile } from '../../../identity'

/** `username`'s profile as the viewer sees it. */
export const GET = (input: {
  readonly params: { readonly username: string }
}): Effect.Effect<{ readonly profile: Schema.Schema.Type<typeof Profile> }, NotFound, Db | Viewer> =>
  Effect.map(profile(input.params.username), (found) => ({ profile: found }))
