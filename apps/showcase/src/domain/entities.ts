/**
 * apps/showcase/src/domain/entities.ts
 *
 * Board entities: plain, client-safe record types.
 */
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface ProjectRecord {
  readonly id: string
  readonly name: string
}

export interface TaskRecord {
  readonly id: string
  readonly projectId: string
  readonly title: string
  readonly status: TaskStatus
  readonly createdAt: number
}

export interface CommentRecord {
  readonly id: string
  readonly taskId: string
  readonly body: string
  readonly authorId: string
  readonly createdAt: number
}

export interface ActivityEvent {
  readonly id: string
  readonly message: string
  readonly at: number
}
