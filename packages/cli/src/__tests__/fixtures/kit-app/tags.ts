import { tag } from '@sleekstack/kit'

export interface Task {
  readonly id: string
  readonly projectId: string
}

export const Store = tag<{ readonly tasks: Map<string, Task> }>('Store')
export const ProjectRepo = tag<{ list(): readonly string[] }>('ProjectRepo')
export const TaskRepo = tag<{ listByProject(projectId: string): readonly Task[] }>('TaskRepo')
export const CommentRepo = tag<{ count(): number }>('CommentRepo')
export const ActivityLog = tag<{ record(message: string): void }>('ActivityLog')
export const Clock = tag<{ now(): number }>('Clock')
export const Logger = tag<{ log(message: string): void }>('Logger')
export const IdGen = tag<{ next(prefix: string): string }>('IdGen')
export const RequestContext = tag<{ readonly requestId: string }>('RequestContext')
export const UnitOfWork = tag<{ commit(): void }>('UnitOfWork')
