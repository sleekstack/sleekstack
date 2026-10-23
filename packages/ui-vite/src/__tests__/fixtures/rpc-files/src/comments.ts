import { Data, Schema } from 'effect'

/** Client-safe: the generated client imports both. */
export const Body = Schema.NonEmptyString

export class CommentMissing extends Data.TaggedError('CommentMissing')<{ readonly id: number }> {}
