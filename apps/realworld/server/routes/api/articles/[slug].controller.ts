import { Effect, type Schema } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../../src/errors'
import type { Article, UpdateArticle } from '../../../../src/modules/articles'
import type { Viewer } from '../../../../src/modules/identity'
import { type Articles, articles } from '../../../articles'

type Params = { readonly slug: string }
type Answer = { readonly article: Schema.Schema.Type<typeof Article> }

/** The article at `slug` as the viewer sees it. */
export const GET = (input: { readonly params: Params }): Effect.Effect<Answer, NotFound, Articles | Viewer> =>
  articles.get(input.params.slug).pipe(Effect.map((article) => ({ article })))

/** Updates the viewer's own article; a new title gives a new slug, carried in the answer. */
export const PUT = (input: {
  readonly params: Params
  readonly body: { readonly article: Schema.Schema.Type<typeof UpdateArticle> }
}): Effect.Effect<Answer, Unauthorized | Forbidden | NotFound | ValidationError, Articles | Viewer> =>
  articles.update(input.params.slug, input.body.article).pipe(Effect.map((article) => ({ article })))

/** Deletes the viewer's own article: 204. */
export const DELETE = (input: {
  readonly params: Params
}): Effect.Effect<void, Unauthorized | Forbidden | NotFound, Articles | Viewer> => articles.delete(input.params.slug)
