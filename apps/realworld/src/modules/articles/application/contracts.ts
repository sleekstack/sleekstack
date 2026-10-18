import { Schema } from 'effect'
import { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../errors'
import { Article, ArticleList, ArticleQuery, NewArticle, Page, UpdateArticle } from '../domain/model'

// The client-safe halves of the article server functions: ids and Schemas, built into functions by `server/app.ts`.
// A stale session cookie reads as anonymous; `Unauthorized` is for one that needs a signed-in viewer.

const BySlug = Schema.Struct({ slug: Schema.String })

export const listArticlesContract = {
  id: 'articles.list',
  input: ArticleQuery,
  success: ArticleList,
  error: Schema.Union(ValidationError, Unauthorized),
}

export const feedContract = {
  id: 'articles.feed',
  input: Page,
  success: ArticleList,
  error: Schema.Union(ValidationError, Unauthorized),
}

export const getArticleContract = {
  id: 'articles.get',
  input: BySlug,
  success: Article,
  error: Schema.Union(Unauthorized, NotFound),
}

export const createArticleContract = {
  id: 'articles.create',
  input: NewArticle,
  success: Article,
  error: Schema.Union(ValidationError, Unauthorized),
}

export const updateArticleContract = {
  id: 'articles.update',
  input: Schema.Struct({ slug: Schema.String, article: UpdateArticle }),
  success: Article,
  error: Schema.Union(ValidationError, Unauthorized, Forbidden, NotFound),
}

export const deleteArticleContract = {
  id: 'articles.delete',
  input: BySlug,
  success: Schema.Void,
  error: Schema.Union(Unauthorized, Forbidden, NotFound),
}

export const favoriteContract = {
  id: 'articles.favorite',
  input: BySlug,
  success: Article,
  error: Schema.Union(Unauthorized, NotFound),
}

export const unfavoriteContract = {
  id: 'articles.unfavorite',
  input: BySlug,
  success: Article,
  error: Schema.Union(Unauthorized, NotFound),
}

/** Every tag in use, sorted. */
export const tagsContract = {
  id: 'tags.list',
  input: Schema.Void,
  success: Schema.Array(Schema.String),
  error: Unauthorized,
}
