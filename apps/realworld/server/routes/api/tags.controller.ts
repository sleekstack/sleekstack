import { Effect } from 'effect'
import { type Articles, articles } from '../../articles'

/** Every tag in use, by name. */
export const GET = (): Effect.Effect<{ readonly tags: readonly string[] }, never, Articles> =>
  articles.tags().pipe(Effect.map((list) => ({ tags: list })))
