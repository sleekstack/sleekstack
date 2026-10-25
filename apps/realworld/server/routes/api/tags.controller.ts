import { Effect } from 'effect'
import { Articles } from '../../articles'

/** Every tag in use, by name. */
export const GET = (): Effect.Effect<{ readonly tags: readonly string[] }, never, Articles> =>
  Effect.gen(function* () {
    const articles = yield* Articles
    return { tags: yield* articles.tags() }
  })
