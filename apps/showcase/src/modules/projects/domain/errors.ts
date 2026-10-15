import { Data } from 'effect'

export class ProjectNotFound extends Data.TaggedError('ProjectNotFound')<{ id: string }> {}
