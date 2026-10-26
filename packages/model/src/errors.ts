import { Data } from 'effect'

/** The adapter has no record `id` of type `type`. */
export class RecordNotFound extends Data.TaggedError('RecordNotFound')<{
  readonly type: string
  readonly id: string
}> {}

/** The adapter refused the change to the record `id` of type `type`; `message` says why. */
export class RecordRejected extends Data.TaggedError('RecordRejected')<{
  readonly type: string
  readonly id: string
  readonly message: string
}> {}
