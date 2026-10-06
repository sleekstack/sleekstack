import { Data } from 'effect'

export class ProjectNotFound extends Data.TaggedError('ProjectNotFound')<{ id: string }> {}
export class TaskNotFound extends Data.TaggedError('TaskNotFound')<{ id: string }> {}
export class UserNotFound extends Data.TaggedError('UserNotFound')<{ id: string }> {}
