import { Effect, type Schema } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../../src/errors'
import type { Article, UpdateArticle } from '../../../../src/modules/articles'
import type { Viewer } from '../../../../src/modules/identity'
import { deleteArticle, getArticle, updateArticle } from '../../../articles'
import type { Db } from '../../../db'

type Params = { readonly slug: string }
type Answer = { readonly article: Schema.Schema.Type<typeof Article> }

/** The article at `slug` as the viewer sees it. */
export const GET = (input: { readonly params: Params }): Effect.Effect<Answer, NotFound, Db | Viewer> =>
  Effect.map(getArticle(input.params.slug), (article) => ({ article }))

/** Updates the viewer's own article; a new title gives a new slug, carried in the answer. */
export const PUT = (input: {
  readonly params: Params
  readonly body: { readonly article: Schema.Schema.Type<typeof UpdateArticle> }
}): Effect.Effect<Answer, Unauthorized | Forbidden | NotFound | ValidationError, Db | Viewer> =>
  Effect.map(updateArticle(input.params.slug, input.body.article), (article) => ({ article }))

/** Deletes the viewer's own article: 204. */
export const DELETE = (input: {
  readonly params: Params
}): Effect.Effect<void, Unauthorized | Forbidden | NotFound, Db | Viewer> => deleteArticle(input.params.slug)
