export type Status = 'todo' | 'in_progress' | 'done'
export const STATUSES: ReadonlyArray<Status> = ['todo', 'in_progress', 'done']
export type Priority = 'low' | 'medium' | 'high'
export interface User {
  readonly id: string
  readonly name: string
  readonly canEdit: boolean
}
export interface Project {
  readonly id: string
  readonly name: string
}
export interface Task {
  readonly id: string
  readonly projectId: string
  readonly title: string
  readonly status: Status
  readonly priority: Priority
  readonly labels: ReadonlyArray<string>
  /** ISO date, or null. */
  readonly due: string | null
  /** A user id; may name someone who has since left the team. */
  readonly assigneeId: string | null
  readonly votes: number
}
export interface NewTask {
  readonly title: string
  readonly priority: Priority
}
