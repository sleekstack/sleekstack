import { Controller, type Gen, ResponseStatus } from '@sleekstack/start'
import type { Schema } from 'effect'
import type { NotFound, Unauthorized, ValidationError } from '../../../../../src/errors'
import type { Comment, NewComment } from '../../../../../src/modules/comments'
import type { Viewer } from '../../../../../src/modules/identity'
import { Articles } from '../../../../articles'
import { addComment, listComments } from '../../../../comments'
import type { Db } from '../../../../db'

type Params = { readonly slug: string }

/** Declares `Articles`, which the comment functions shared with the RPC File reach through their context. */
export default class extends Controller({ articles: Articles }) {
  /** The comments on the article at `slug`, newest first. */
  *GET(input: {
    readonly params: Params
  }): Gen<{ readonly comments: readonly Schema.Schema.Type<typeof Comment>[] }, NotFound, Db | Articles | Viewer> {
    return { comments: yield* listComments(input.params.slug) }
  }

  /** Adds the signed-in viewer's comment to the article at `slug`: 201 with the comment. */
  *POST(input: {
    readonly params: Params
    readonly body: { readonly comment: Schema.Schema.Type<typeof NewComment> }
  }): Gen<
    { readonly comment: Schema.Schema.Type<typeof Comment> },
    Unauthorized | ValidationError | NotFound,
    Db | Articles | Viewer | ResponseStatus
  > {
    const comment = yield* addComment(input.params.slug, input.body.comment)
    yield* ResponseStatus.set(201)
    return { comment }
  }
}
