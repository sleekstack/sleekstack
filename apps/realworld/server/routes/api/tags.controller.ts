import { Effect } from 'effect'
import { tags } from '../../articles'
import type { Db } from '../../db'

/** Every tag in use, by name. */
export const GET = (): Effect.Effect<{ readonly tags: readonly string[] }, never, Db> =>
  Effect.map(tags, (list) => ({ tags: list }))
