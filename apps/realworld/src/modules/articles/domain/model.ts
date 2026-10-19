import { Schema } from 'effect'
import { Profile } from '../../identity'

/** An article as the viewer sees it: `favorited` and `author.following` are false for an anonymous viewer. */
export const Article = Schema.Struct({
  slug: Schema.String,
  title: Schema.String,
  description: Schema.String,
  body: Schema.String,
  tagList: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  favorited: Schema.Boolean,
  favoritesCount: Schema.Number,
  author: Profile,
})
export type Article = typeof Article.Type

/** One page of articles; `articlesCount` is the total match, not the page size. */
export const ArticleList = Schema.Struct({ articles: Schema.Array(Article), articlesCount: Schema.Number })
export type ArticleList = typeof ArticleList.Type

// Blank fields pass the Schemas: the service reports them as a `ValidationError` keyed by field.
export const NewArticle = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  body: Schema.String,
  tagList: Schema.optional(Schema.Array(Schema.String)),
})
export type NewArticle = typeof NewArticle.Type

/** A partial update: an absent field stays as it is; a new title gives a new slug. */
export const UpdateArticle = Schema.partial(NewArticle)
export type UpdateArticle = typeof UpdateArticle.Type

/** `limit` and `offset` arrive as query strings on REST; a non-numeric one is a `ValidationError`. */
const PageParam = Schema.optional(Schema.Union(Schema.String, Schema.Number))

/** Paging for a list or the feed: `limit` defaults to 20 and clamps to [1, 100], `offset` to 0 and at least 0. */
export const Page = Schema.Struct({ limit: PageParam, offset: PageParam })
export type Page = typeof Page.Type

/** List filters, combined with AND: a tag, an author's username, the username of someone who favorited it. */
export const ArticleQuery = Schema.Struct({
  ...Page.fields,
  tag: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  favorited: Schema.optional(Schema.String),
})
export type ArticleQuery = typeof ArticleQuery.Type
