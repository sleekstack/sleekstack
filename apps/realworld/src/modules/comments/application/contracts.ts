import { ServerService } from '@sleekstack/start/client'
import type { Effect } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../errors'
import type { Comment, NewComment } from '../domain/model'

/**
 * The comments Server Service: the contract only. `server/comments-api.server.ts` implements it; every method runs as
 * the session cookie's viewer.
 */
export class CommentsApi extends ServerService('CommentsApi')<
  CommentsApi,
  {
    /** The comments on the article at `slug`, newest first. */
    readonly list: (input: { readonly slug: string }) => Effect.Effect<ReadonlyArray<Comment>, Unauthorized | NotFound>
    readonly add: (input: {
      readonly slug: string
      readonly comment: NewComment
    }) => Effect.Effect<Comment, ValidationError | Unauthorized | NotFound>
    readonly delete: (input: {
      readonly slug: string
      readonly id: number
    }) => Effect.Effect<void, Unauthorized | Forbidden | NotFound>
  }
>() {}
