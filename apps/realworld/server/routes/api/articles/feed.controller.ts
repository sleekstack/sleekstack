import { Controller, type Gen } from '@sleekstack/start'
import type { Schema } from 'effect'
import type { Unauthorized, ValidationError } from '../../../../src/errors'
import type { ArticleList } from '../../../../src/modules/articles'
import type { Viewer } from '../../../../src/modules/identity'
import { Articles } from '../../../articles'

export default class extends Controller({ articles: Articles }) {
  /** Articles by the authors the signed-in viewer follows, newest first. A static route, so never an article's slug. */
  *GET(input: {
    readonly query: { readonly limit?: string; readonly offset?: string }
  }): Gen<Schema.Schema.Type<typeof ArticleList>, Unauthorized | ValidationError, Viewer> {
    return yield* this.articles.feed(input.query)
  }
}
