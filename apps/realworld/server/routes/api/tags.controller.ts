import { Effect } from 'effect'
import { Articles } from '../../articles'

/** Every tag in use, by name. */
export const GET = (): Effect.Effect<{ readonly tags: readonly string[] }, never, Articles> =>
  Effect.flatMap(Articles, (articles) => articles.tags()).pipe(Effect.map((list) => ({ tags: list })))
