import type { RpcWrap } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../src/errors'
import type { Article, ArticleList, ArticleQuery, NewArticle, Page, UpdateArticle } from '../src/modules/articles'
import type { Viewer } from '../src/modules/identity'
import {
  createArticle,
  deleteArticle,
  favorite as favoriteArticle,
  feed as feedOf,
  getArticle,
  listArticles,
  tags as allTags,
  unfavorite as unfavoriteArticle,
  updateArticle,
} from './articles'
import type { Db } from './db'
import type { TokenSecret } from './identity'
import { asViewer } from './session'

/**
 * Every method runs as the session cookie's viewer. A stale session cookie reads as anonymous; `Unauthorized` is for
 * one that needs a signed-in viewer.
 */
export const wrap: RpcWrap = asViewer

/** The articles `input` filters, newest first. */
export const list = (
  input: Schema.Schema.Type<typeof ArticleQuery>,
): Effect.Effect<Schema.Schema.Type<typeof ArticleList>, ValidationError | Unauthorized, Db | TokenSecret | Viewer> =>
  listArticles(input)

/** The articles of the authors the viewer follows, newest first. */
export const feed = (
  input: Schema.Schema.Type<typeof Page>,
): Effect.Effect<Schema.Schema.Type<typeof ArticleList>, ValidationError | Unauthorized, Db | TokenSecret | Viewer> =>
  feedOf(input)

/** The article at `slug`. */
export const get = (input: {
  readonly slug: string
}): Effect.Effect<Schema.Schema.Type<typeof Article>, Unauthorized | NotFound, Db | TokenSecret | Viewer> =>
  getArticle(input.slug)

/** Writes the viewer's new article. */
export const create = (
  input: Schema.Schema.Type<typeof NewArticle>,
): Effect.Effect<Schema.Schema.Type<typeof Article>, ValidationError | Unauthorized, Db | TokenSecret | Viewer> =>
  // The article just written is always found: a `NotFound` here is a defect.
  Effect.catchTag(createArticle(input), 'NotFound', Effect.die)

/** Updates the given fields of the viewer's own article at `slug`. */
export const update = (input: {
  readonly slug: string
  readonly article: Schema.Schema.Type<typeof UpdateArticle>
}): Effect.Effect<
  Schema.Schema.Type<typeof Article>,
  ValidationError | Unauthorized | Forbidden | NotFound,
  Db | TokenSecret | Viewer
> => updateArticle(input.slug, input.article)

/** Deletes the viewer's own article at `slug`. */
const remove = (input: {
  readonly slug: string
}): Effect.Effect<void, Unauthorized | Forbidden | NotFound, Db | TokenSecret | Viewer> => deleteArticle(input.slug)
export { remove as delete }

/** Favorites the article at `slug`. */
export const favorite = (input: {
  readonly slug: string
}): Effect.Effect<Schema.Schema.Type<typeof Article>, Unauthorized | NotFound, Db | TokenSecret | Viewer> =>
  favoriteArticle(input.slug)

/** Unfavorites the article at `slug`. */
export const unfavorite = (input: {
  readonly slug: string
}): Effect.Effect<Schema.Schema.Type<typeof Article>, Unauthorized | NotFound, Db | TokenSecret | Viewer> =>
  unfavoriteArticle(input.slug)

/** Every tag in use, sorted. */
export const tags = (): Effect.Effect<ReadonlyArray<string>, Unauthorized, Db | TokenSecret | Viewer> => allTags
