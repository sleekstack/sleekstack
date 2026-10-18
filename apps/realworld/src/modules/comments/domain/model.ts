import { Schema } from 'effect'
import { Profile } from '../../identity'

/** A comment as the viewer sees it: `author.following` is false for an anonymous viewer. */
export const Comment = Schema.Struct({
  id: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  body: Schema.String,
  author: Profile,
})
export type Comment = typeof Comment.Type

// A blank body passes the Schema: the service reports it as a `ValidationError` on `body`.
export const NewComment = Schema.Struct({ body: Schema.String })
export type NewComment = typeof NewComment.Type
