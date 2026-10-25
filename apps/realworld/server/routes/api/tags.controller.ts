import { Controller, type Gen } from '@sleekstack/start'
import { Articles } from '../../articles'

export default class extends Controller({ articles: Articles }) {
  /** Every tag in use, by name. */
  *GET(): Gen<{ readonly tags: readonly string[] }> {
    return { tags: yield* this.articles.tags() }
  }
}
