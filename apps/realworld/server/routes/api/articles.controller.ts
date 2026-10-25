import { ResponseStatus } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { NotFound, Unauthorized, ValidationError } from '../../../src/errors'
import type { Article, ArticleList, NewArticle } from '../../../src/modules/articles'
import type { Viewer } from '../../../src/modules/identity'
import { Articles } from '../../articles'

/** Articles filtered by tag, author and favoriting user, newest first; a non-numeric `limit` or `offset` is 422. */
export const GET = (input: {
  readonly query: {
    readonly limit?: string
    readonly offset?: string
    readonly tag?: string
    readonly author?: string
    readonly favorited?: string
  }
}): Effect.Effect<Schema.Schema.Type<typeof ArticleList>, ValidationError, Articles | Viewer> =>
  Effect.gen(function* () {
    const articles = yield* Articles
    return yield* articles.list(input.query)
  })

/** Publishes an article by the signed-in viewer: 201 with the article. */
export const POST = (input: {
  readonly body: { readonly article: Schema.Schema.Type<typeof NewArticle> }
}): Effect.Effect<
  { readonly article: Schema.Schema.Type<typeof Article> },
  Unauthorized | ValidationError | NotFound,
  Articles | Viewer | ResponseStatus
> =>
  Effect.gen(function* () {
    const articles = yield* Articles
    const article = yield* articles.create(input.body.article)
    yield* ResponseStatus.set(201)
    return { article }
  })
