import { Effect, type Schema } from 'effect'
import type { NotFound, Unauthorized } from '../../../../../src/errors'
import type { Article } from '../../../../../src/modules/articles'
import type { Viewer } from '../../../../../src/modules/identity'
import { Articles } from '../../../../articles'

type Input = { readonly params: { readonly slug: string } }
type Answer = { readonly article: Schema.Schema.Type<typeof Article> }

/** The viewer favorites the article at `slug`. */
export const POST = (input: Input): Effect.Effect<Answer, Unauthorized | NotFound, Articles | Viewer> =>
  Effect.flatMap(Articles, (articles) => articles.favorite(input.params.slug)).pipe(
    Effect.map((article) => ({ article })),
  )

/** The viewer unfavorites the article at `slug`. */
export const DELETE = (input: Input): Effect.Effect<Answer, Unauthorized | NotFound, Articles | Viewer> =>
  Effect.flatMap(Articles, (articles) => articles.unfavorite(input.params.slug)).pipe(
    Effect.map((article) => ({ article })),
  )
