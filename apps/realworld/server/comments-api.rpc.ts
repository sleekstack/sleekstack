import type { RpcWrap } from '@sleekstack/start'
import type { Effect, Schema } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../src/errors'
import type { Comment, NewComment } from '../src/modules/comments'
import type { Viewer } from '../src/modules/identity'
import { addComment, deleteComment, listComments } from './comments'
import type { Articles } from './articles'
import type { Db } from './db'
import { asViewer } from './session'

/** Every method runs as the session cookie's viewer. */
export const wrap: RpcWrap = asViewer

/** The comments on the article at `slug`, newest first. */
export const list = (input: {
  readonly slug: string
}): Effect.Effect<ReadonlyArray<Schema.Schema.Type<typeof Comment>>, Unauthorized | NotFound, Db | Articles | Viewer> =>
  listComments(input.slug)

/** Adds the viewer's comment to the article at `slug`. */
export const add = (input: {
  readonly slug: string
  readonly comment: Schema.Schema.Type<typeof NewComment>
}): Effect.Effect<
  Schema.Schema.Type<typeof Comment>,
  ValidationError | Unauthorized | NotFound,
  Db | Articles | Viewer
> => addComment(input.slug, input.comment)

/** Deletes the viewer's own comment `id` on the article at `slug`. */
const remove = (input: {
  readonly slug: string
  readonly id: number
}): Effect.Effect<void, Unauthorized | Forbidden | NotFound, Db | Articles | Viewer> =>
  deleteComment(input.slug, input.id)
export { remove as delete }
