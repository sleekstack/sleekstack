import { Controller, type Gen } from '@sleekstack/start'
import type { Forbidden, NotFound, Unauthorized } from '../../../../../../src/errors'
import type { Viewer } from '../../../../../../src/modules/identity'
import { Articles } from '../../../../../articles'
import { deleteComment } from '../../../../../comments'
import type { Db } from '../../../../../db'

/** Declares `Articles`, which the comment functions shared with the RPC File reach through their context. */
export default class extends Controller({ articles: Articles }) {
  /** Deletes the viewer's own comment: 204. A non-numeric `id` fails to decode, which `wrap` answers with the JSON 404. */
  *DELETE(input: {
    readonly params: { readonly slug: string; readonly id: number }
  }): Gen<void, Unauthorized | Forbidden | NotFound, Db | Articles | Viewer> {
    return yield* deleteComment(input.params.slug, input.params.id)
  }
}
