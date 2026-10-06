import { Data } from 'effect'

export class UserNotFound extends Data.TaggedError('UserNotFound')<{ id: string }> {}
