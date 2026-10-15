/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, useAtomValue } from '@sleekstack/ui'
import { selectedAtom } from '../application/state'
import { useTaskActions } from '../application/tasks'
import { TaskNotFound } from '../domain/errors'
import { STATUSES, type Task } from '../domain/model'
import { MaybeAssignee, Viewer } from '../../identity'
import { STATUS_LABEL, StatusBadge } from './shared'

/** The open task, from the project's tasks; only editors can move or delete it. Fails with `TaskNotFound` when it is gone. */
const Detail = function* ({ projectId, tasks }: { projectId: string; tasks: ReadonlyArray<Task> }) {
  const id = yield* useAtomValue(selectedAtom)
  if (id === null) return <p className="detail muted">Select a task</p>
  const task = tasks.find((t) => t.id === id)
  if (!task) return Effect.fail(new TaskNotFound({ id }))
  const { user: viewer } = yield* Viewer
  const { move, remove } = yield* useTaskActions(projectId)
  return (
    <aside className="detail">
      <h2>{task.title}</h2>
      <StatusBadge status={task.status} />
      <MaybeAssignee id={task.assigneeId} />
      {viewer.canEdit ? (
        <div className="row actions">
          {STATUSES.filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              type="button"
              className="move"
              data-status={s}
              onClick={() => move.mutate({ id: task.id, status: s })}
            >
              Move to {STATUS_LABEL[s]}
            </button>
          ))}
          <button type="button" className="delete" onClick={() => remove.mutate(task.id)}>
            Delete
          </button>
        </div>
      ) : (
        <p className="muted">Read only</p>
      )}
    </aside>
  )
}

export const DetailPanel = ({ projectId, tasks }: { projectId: string; tasks: ReadonlyArray<Task> }) => (
  <div className="selected">
    <Boundary tag="TaskNotFound" fallback={(_: TaskNotFound) => <p className="error">This task no longer exists</p>}>
      <Detail projectId={projectId} tasks={tasks} />
    </Boundary>
  </div>
)
