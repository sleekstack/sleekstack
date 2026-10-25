import { Controller, type Gen } from '@sleekstack/start'
import type { Schema } from 'effect'
import type { NotFound, Unauthorized } from '../../../../../src/errors'
import type { Article } from '../../../../../src/modules/articles'
import type { Viewer } from '../../../../../src/modules/identity'
import { Articles } from '../../../../articles'

type Input = { readonly params: { readonly slug: string } }
type Answer = { readonly article: Schema.Schema.Type<typeof Article> }

export default class extends Controller({ articles: Articles }) {
  /** The viewer favorites the article at `slug`. */
  *POST(input: Input): Gen<Answer, Unauthorized | NotFound, Viewer> {
    return { article: yield* this.articles.favorite(input.params.slug) }
  }

  /** The viewer unfavorites the article at `slug`. */
  *DELETE(input: Input): Gen<Answer, Unauthorized | NotFound, Viewer> {
    return { article: yield* this.articles.unfavorite(input.params.slug) }
  }
}
