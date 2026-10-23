import { implement } from '@sleekstack/start'
import { Effect, Layer } from 'effect'
import { ArticlesApi } from '../src/modules/articles'
import type { Viewer } from '../src/modules/identity'
import {
  createArticle,
  deleteArticle,
  favorite,
  feed,
  getArticle,
  listArticles,
  tags,
  unfavorite,
  updateArticle,
} from './articles'
import type { Db } from './db'
import type { TokenSecret } from './identity'
import { asViewer } from './session'

/** `ArticlesApi` over the server's `Db` and `TokenSecret`, taken once when the Layer is built; each call runs as the viewer. */
export const ArticlesApiLive = Layer.unwrapEffect(
  Effect.map(Effect.context<Db | TokenSecret>(), (server) => {
    const run = <A, E>(effect: Effect.Effect<A, E, Db | TokenSecret | Viewer>) =>
      Effect.provide(asViewer(effect), server)
    return implement(ArticlesApi, {
      list: (query) => run(listArticles(query)),
      feed: (page) => run(feed(page)),
      get: ({ slug }) => run(getArticle(slug)),
      // The article just written is always found: a `NotFound` here is a defect.
      create: (input) => run(Effect.catchTag(createArticle(input), 'NotFound', Effect.die)),
      update: ({ slug, article }) => run(updateArticle(slug, article)),
      delete: ({ slug }) => run(deleteArticle(slug)),
      favorite: ({ slug }) => run(favorite(slug)),
      unfavorite: ({ slug }) => run(unfavorite(slug)),
      tags: () => run(tags),
    })
  }),
)
