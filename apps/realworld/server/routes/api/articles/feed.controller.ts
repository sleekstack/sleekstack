import { Effect, type Schema } from 'effect'
import type { Unauthorized, ValidationError } from '../../../../src/errors'
import type { ArticleList } from '../../../../src/modules/articles'
import type { Viewer } from '../../../../src/modules/identity'
import { Articles } from '../../../articles'

/** Articles by the authors the signed-in viewer follows, newest first. A static route, so never an article's slug. */
export const GET = (input: {
  readonly query: { readonly limit?: string; readonly offset?: string }
}): Effect.Effect<Schema.Schema.Type<typeof ArticleList>, Unauthorized | ValidationError, Articles | Viewer> =>
  Effect.gen(function* () {
    const articles = yield* Articles
    return yield* articles.feed(input.query)
  })
