import { Effect } from 'effect'
import type { ProjectNotFound } from './errors'
import type { Project } from './model'

export class ProjectRepo extends Effect.Tag('ProjectRepo')<
  ProjectRepo,
  {
    all(): Effect.Effect<ReadonlyArray<Project>>
    get(id: string): Effect.Effect<Project, ProjectNotFound>
  }
>() {}
