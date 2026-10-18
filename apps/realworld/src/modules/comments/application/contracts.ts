import { Schema } from 'effect'
import { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../errors'
import { Comment, NewComment } from '../domain/model'

// The client-safe halves of the comment server functions: ids and Schemas, built into functions by `server/app.ts`.

export const listCommentsContract = {
  id: 'comments.list',
  input: Schema.Struct({ slug: Schema.String }),
  success: Schema.Array(Comment),
  error: Schema.Union(Unauthorized, NotFound),
}

export const addCommentContract = {
  id: 'comments.add',
  input: Schema.Struct({ slug: Schema.String, comment: NewComment }),
  success: Comment,
  error: Schema.Union(ValidationError, Unauthorized, NotFound),
}

export const deleteCommentContract = {
  id: 'comments.delete',
  input: Schema.Struct({ slug: Schema.String, id: Schema.Number }),
  success: Schema.Void,
  error: Schema.Union(Unauthorized, Forbidden, NotFound),
}
