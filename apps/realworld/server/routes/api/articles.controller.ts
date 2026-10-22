import { ResponseStatus } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { NotFound, Unauthorized, ValidationError } from '../../../src/errors'
import type { Article, ArticleList, NewArticle } from '../../../src/modules/articles'
import type { Viewer } from '../../../src/modules/identity'
import { createArticle, listArticles } from '../../articles'
import type { Db } from '../../db'

/** Articles filtered by tag, author and favoriting user, newest first; a non-numeric `limit` or `offset` is 422. */
export const GET = (input: {
  readonly query: {
    readonly limit?: string
    readonly offset?: string
    readonly tag?: string
    readonly author?: string
    readonly favorited?: string
  }
}): Effect.Effect<Schema.Schema.Type<typeof ArticleList>, ValidationError, Db | Viewer> => listArticles(input.query)

/** Publishes an article by the signed-in viewer: 201 with the article. */
export const POST = (input: {
  readonly body: { readonly article: Schema.Schema.Type<typeof NewArticle> }
}): Effect.Effect<
  { readonly article: Schema.Schema.Type<typeof Article> },
  Unauthorized | ValidationError | NotFound,
  Db | Viewer | ResponseStatus
> =>
  createArticle(input.body.article).pipe(
    Effect.map((article) => ({ article })),
    Effect.zipLeft(ResponseStatus.set(201)),
  )
