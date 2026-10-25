import { Controller, type Gen } from '@sleekstack/start'
import type { Schema } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../../src/errors'
import type { Article, UpdateArticle } from '../../../../src/modules/articles'
import type { Viewer } from '../../../../src/modules/identity'
import { Articles } from '../../../articles'

type Params = { readonly slug: string }
type Answer = { readonly article: Schema.Schema.Type<typeof Article> }

export default class extends Controller({ articles: Articles }) {
  /** The article at `slug` as the viewer sees it. */
  *GET(input: { readonly params: Params }): Gen<Answer, NotFound, Viewer> {
    return { article: yield* this.articles.get(input.params.slug) }
  }

  /** Updates the viewer's own article; a new title gives a new slug, carried in the answer. */
  *PUT(input: {
    readonly params: Params
    readonly body: { readonly article: Schema.Schema.Type<typeof UpdateArticle> }
  }): Gen<Answer, Unauthorized | Forbidden | NotFound | ValidationError, Viewer> {
    return { article: yield* this.articles.update(input.params.slug, input.body.article) }
  }

  /** Deletes the viewer's own article: 204. */
  *DELETE(input: { readonly params: Params }): Gen<void, Unauthorized | Forbidden | NotFound, Viewer> {
    return yield* this.articles.delete(input.params.slug)
  }
}
