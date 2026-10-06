/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, Pending, useAtomValue, useSetAtom } from '@sleekstack/ui'
import { MaybeAssignee, Viewer } from '../../identity'
import { filterAtom, selectedAtom } from '../application/state'
import { useSuspenseTasks, useTaskActions, type QueryFailed } from '../application/tasks'
import { STATUSES, type Status, type Task } from '../domain/model'
import { DetailPanel } from './detail'
import { AddTaskForm, FilterBar, Votes } from './guests'
import { PriorityBadge, STATUS_LABEL } from './shared'
import { Triage } from './triage'

export const TaskCard = function* ({ task }: { task: Task }) {
  const select = yield* useSetAtom(selectedAtom)
  return (
    <article className="card" data-id={task.id}>
      <h4>
        <button type="button" className="open" onClick={() => Effect.sync(() => select(task.id))}>
          {task.title}
        </button>
      </h4>
      <div className="row">
        <PriorityBadge priority={task.priority} />
        {task.due && <time dateTime={task.due}>{task.due}</time>}
        {task.labels.map((l) => (
          <span key={l} className="label">
            {l}
          </span>
        ))}
      </div>
      <div className="row">
        <MaybeAssignee id={task.assigneeId} />
        <Votes initial={task.votes} />
      </div>
    </article>
  )
}

export const StatusColumn = ({ status, tasks }: { status: Status; tasks: ReadonlyArray<Task> }) => (
  <section className="column">
    <h3>
      {STATUS_LABEL[status]} <small>{tasks.length}</small>
    </h3>
    {tasks.map((t) => (
      <TaskCard key={t.id} task={t} />
    ))}
    {tasks.length === 0 && <p className="muted">Nothing here</p>}
  </section>
)

/** Re-runs when the status filter changes. */
const Columns = function* ({ tasks }: { tasks: ReadonlyArray<Task> }) {
  const filter = yield* useAtomValue(filterAtom)
  return (
    <div className="columns">
      {STATUSES.filter((s) => filter === 'all' || filter === s).map((s) => (
        <StatusColumn key={s} status={s} tasks={tasks.filter((t) => t.status === s)} />
      ))}
    </div>
  )
}

/** Sets the status filter from guest buttons; reads no atom, so it never re-runs. */
const Toolbar = function* () {
  const setFilter = yield* useSetAtom(filterAtom)
  return (
    <nav className="toolbar">
      <FilterBar options={['all', ...STATUSES]} onPick={setFilter} />
    </nav>
  )
}

/** Hands `mutate` to the React form; re-runs only on its own mutation's status. Editors only. */
const NewTask = function* ({ projectId }: { projectId: string }) {
  const { user: viewer } = yield* Viewer
  if (!viewer.canEdit) return <p className="muted">Read only: {viewer.name} cannot add tasks</p>
  const { add } = yield* useTaskActions(projectId)
  return <AddTaskForm onAdd={(task) => add.mutate(task)} />
}

/** Waits on the project's tasks through the query cache (under `Pending`). */
const Workspace = function* ({ projectId }: { projectId: string }) {
  const tasks = yield* useSuspenseTasks(projectId)
  return (
    <div className="workspace">
      <Toolbar />
      <Columns tasks={tasks} />
      <DetailPanel projectId={projectId} tasks={tasks} />
      <Triage tasks={tasks} />
    </div>
  )
}

/** One project's tasks: the new-task form (editors), then the board, detail panel and triage list under `Pending`. */
export const ProjectBoard = ({ projectId }: { projectId: string }) => (
  <>
    <NewTask projectId={projectId} />
    <Boundary tag="QueryFailed" fallback={(_: QueryFailed) => <p className="error">Tasks failed to load</p>}>
      <Pending fallback={<p className="muted spinner">Loading tasks</p>}>
        <Workspace projectId={projectId} />
      </Pending>
    </Boundary>
  </>
)
