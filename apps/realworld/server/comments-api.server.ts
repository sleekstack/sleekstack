import { implement } from '@sleekstack/start'
import { Effect, Layer } from 'effect'
import { CommentsApi } from '../src/modules/comments'
import type { Viewer } from '../src/modules/identity'
import { addComment, deleteComment, listComments } from './comments'
import type { Db } from './db'
import type { TokenSecret } from './identity'
import { asViewer } from './identity-api.server'

/** `CommentsApi` over the server's `Db` and `TokenSecret`, taken once when the Layer is built; each call runs as the viewer. */
export const CommentsApiLive = Layer.unwrapEffect(
  Effect.map(Effect.context<Db | TokenSecret>(), (server) => {
    const run = <A, E>(effect: Effect.Effect<A, E, Db | TokenSecret | Viewer>) =>
      Effect.provide(asViewer(effect), server)
    return implement(CommentsApi, {
      list: ({ slug }) => run(listComments(slug)),
      add: ({ slug, comment }) => run(addComment(slug, comment)),
      delete: ({ slug, id }) => run(deleteComment(slug, id)),
    })
  }),
)
