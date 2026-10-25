import { Controller, type Gen, ResponseStatus } from '@sleekstack/start'
import type { Schema } from 'effect'
import type { NotFound, Unauthorized, ValidationError } from '../../../src/errors'
import type { Article, ArticleList, NewArticle } from '../../../src/modules/articles'
import type { Viewer } from '../../../src/modules/identity'
import { Articles } from '../../articles'

export default class extends Controller({ articles: Articles }) {
  /** Articles filtered by tag, author and favoriting user, newest first; a non-numeric `limit` or `offset` is 422. */
  *GET(input: {
    readonly query: {
      readonly limit?: string
      readonly offset?: string
      readonly tag?: string
      readonly author?: string
      readonly favorited?: string
    }
  }): Gen<Schema.Schema.Type<typeof ArticleList>, ValidationError, Viewer> {
    return yield* this.articles.list(input.query)
  }

  /** Publishes an article by the signed-in viewer: 201 with the article. */
  *POST(input: {
    readonly body: { readonly article: Schema.Schema.Type<typeof NewArticle> }
  }): Gen<
    { readonly article: Schema.Schema.Type<typeof Article> },
    Unauthorized | ValidationError | NotFound,
    Viewer | ResponseStatus
  > {
    const article = yield* this.articles.create(input.body.article)
    yield* ResponseStatus.set(201)
    return { article }
  }
}
