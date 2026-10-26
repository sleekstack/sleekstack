import { Effect, Layer } from 'effect'
import { ArticleAdapter } from '../article'

export default Layer.succeed(ArticleAdapter, {
  find: (id) => Effect.succeed({ id, title: '' }),
  save: (id, change: { readonly title: string }) => Effect.succeed({ id, ...change }),
})
