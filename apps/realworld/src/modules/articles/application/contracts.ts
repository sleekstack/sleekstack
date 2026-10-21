import { ServerService } from '@sleekstack/start/client'
import type { Effect } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../errors'
import type { Article, ArticleList, ArticleQuery, NewArticle, Page, UpdateArticle } from '../domain/model'

export interface BySlug {
  readonly slug: string
}

/**
 * The articles Server Service: the contract only. `server/articles-api.server.ts` implements it; every method runs as
 * the session cookie's viewer. A stale session cookie reads as anonymous; `Unauthorized` is for one that needs a
 * signed-in viewer.
 */
export class ArticlesApi extends ServerService('ArticlesApi')<
  ArticlesApi,
  {
    readonly list: (input: ArticleQuery) => Effect.Effect<ArticleList, ValidationError | Unauthorized>
    readonly feed: (input: Page) => Effect.Effect<ArticleList, ValidationError | Unauthorized>
    readonly get: (input: BySlug) => Effect.Effect<Article, Unauthorized | NotFound>
    readonly create: (input: NewArticle) => Effect.Effect<Article, ValidationError | Unauthorized>
    readonly update: (input: {
      readonly slug: string
      readonly article: UpdateArticle
    }) => Effect.Effect<Article, ValidationError | Unauthorized | Forbidden | NotFound>
    readonly delete: (input: BySlug) => Effect.Effect<void, Unauthorized | Forbidden | NotFound>
    readonly favorite: (input: BySlug) => Effect.Effect<Article, Unauthorized | NotFound>
    readonly unfavorite: (input: BySlug) => Effect.Effect<Article, Unauthorized | NotFound>
    /** Every tag in use, sorted. */
    readonly tags: () => Effect.Effect<ReadonlyArray<string>, Unauthorized>
  }
>() {}
