import { ResponseStatus } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { NotFound, Unauthorized, ValidationError } from '../../../../../src/errors'
import type { Comment, NewComment } from '../../../../../src/modules/comments'
import type { Viewer } from '../../../../../src/modules/identity'
import { addComment, listComments } from '../../../../comments'
import type { Articles } from '../../../../articles'
import type { Db } from '../../../../db'

type Params = { readonly slug: string }

/** The comments on the article at `slug`, newest first. */
export const GET = (input: {
  readonly params: Params
}): Effect.Effect<
  { readonly comments: readonly Schema.Schema.Type<typeof Comment>[] },
  NotFound,
  Db | Articles | Viewer
> => Effect.map(listComments(input.params.slug), (comments) => ({ comments }))

/** Adds the signed-in viewer's comment to the article at `slug`: 201 with the comment. */
export const POST = (input: {
  readonly params: Params
  readonly body: { readonly comment: Schema.Schema.Type<typeof NewComment> }
}): Effect.Effect<
  { readonly comment: Schema.Schema.Type<typeof Comment> },
  Unauthorized | ValidationError | NotFound,
  Db | Articles | Viewer | ResponseStatus
> =>
  addComment(input.params.slug, input.body.comment).pipe(
    Effect.map((comment) => ({ comment })),
    Effect.zipLeft(ResponseStatus.set(201)),
  )
