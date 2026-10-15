/** @jsxImportSource @sleekstack/ui */
import type { Priority, Status } from '../domain/model'

export const STATUS_LABEL: Record<Status, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

export const StatusBadge = ({ status }: { status: Status }) => (
  <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
)
export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <span className={`priority ${priority}`}>{priority}</span>
)
