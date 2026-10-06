import { Data } from 'effect'

export class TaskNotFound extends Data.TaggedError('TaskNotFound')<{ id: string }> {}
