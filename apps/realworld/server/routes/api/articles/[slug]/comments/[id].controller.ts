import type { Effect } from 'effect'
import type { Forbidden, NotFound, Unauthorized } from '../../../../../../src/errors'
import type { Viewer } from '../../../../../../src/modules/identity'
import { deleteComment } from '../../../../../comments'
import type { Articles } from '../../../../../articles'
import type { Db } from '../../../../../db'

/** Deletes the viewer's own comment: 204. A non-numeric `id` fails to decode, which `wrap` answers with the JSON 404. */
export const DELETE = (input: {
  readonly params: { readonly slug: string; readonly id: number }
}): Effect.Effect<void, Unauthorized | Forbidden | NotFound, Db | Articles | Viewer> =>
  deleteComment(input.params.slug, input.params.id)
