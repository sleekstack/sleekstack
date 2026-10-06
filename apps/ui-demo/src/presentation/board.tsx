/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, Pending, useAtomValue, useSetAtom } from '@sleekstack/ui'
import { filterAtom, projectAtom, selectedAtom } from '../application/state'
import { useSuspenseTasks, useTaskActions, type QueryFailed } from '../application/tasks'
import type { ProjectNotFound } from '../domain/errors'
import { STATUSES, type Status, type Task } from '../domain/model'
import { TaskRepo, Viewer } from '../domain/ports'
import { DetailPanel } from './detail'
import { AddTaskForm, FilterBar, Votes } from './guests'
import { MaybeAssignee, PriorityBadge, STATUS_LABEL } from './shared'
import { Triage } from './triage'

export const TaskCard = ({ task }: { task: Task }) =>
  Effect.gen(function* () {
    const select = yield* useSetAtom(selectedAtom)
    return yield* (
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
  })

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
const Columns = ({ tasks }: { tasks: ReadonlyArray<Task> }) =>
  Effect.gen(function* () {
    const filter = yield* useAtomValue(filterAtom)
    return yield* (
      <div className="columns">
        {STATUSES.filter((s) => filter === 'all' || filter === s).map((s) => (
          <StatusColumn key={s} status={s} tasks={tasks.filter((t) => t.status === s)} />
        ))}
      </div>
    )
  })

/** Sets the status filter from guest buttons; reads no atom, so it never re-runs. */
const Toolbar = () =>
  Effect.gen(function* () {
    const setFilter = yield* useSetAtom(filterAtom)
    return yield* (
      <nav className="toolbar">
        <FilterBar options={['all', ...STATUSES]} onPick={setFilter} />
      </nav>
    )
  })

/** Hands `mutate` to the React form; re-runs only on its own mutation's status. Editors only. */
const NewTask = ({ projectId }: { projectId: string }) =>
  Effect.gen(function* () {
    const { user: viewer } = yield* Viewer
    if (!viewer.canEdit) return yield* <p className="muted">Read only: {viewer.name} cannot add tasks</p>
    const { add } = yield* useTaskActions(projectId)
    return yield* <AddTaskForm onAdd={(task) => add.mutate(task)} />
  })

/** Waits on the project's tasks through the query cache (under `Pending`). */
const Workspace = ({ projectId }: { projectId: string }) =>
  Effect.gen(function* () {
    const tasks = yield* useSuspenseTasks(projectId)
    return yield* (
      <div className="workspace">
        <Toolbar />
        <Columns tasks={tasks} />
        <DetailPanel projectId={projectId} tasks={tasks} />
        <Triage tasks={tasks} />
      </div>
    )
  })

/** Needs TaskRepo; fails with ProjectNotFound for an unknown or archived project. */
const ProjectView = ({ projectId }: { projectId: string }) =>
  Effect.gen(function* () {
    const project = yield* TaskRepo.project(projectId)
    return yield* (
      <section className="board">
        <h2>{project.name}</h2>
        <NewTask projectId={projectId} />
        <Boundary tag="QueryFailed" fallback={(_: QueryFailed) => <p className="error">Tasks failed to load</p>}>
          <Pending fallback={<p className="muted spinner">Loading tasks</p>}>
            <Workspace projectId={projectId} />
          </Pending>
        </Boundary>
      </section>
    )
  })

/** Re-runs when the project changes. */
export const ProjectPage = () =>
  Effect.gen(function* () {
    const projectId = yield* useAtomValue(projectAtom)
    return yield* (
      <Boundary tag="ProjectNotFound" fallback={(e: ProjectNotFound) => <p className="error">No project "{e.id}"</p>}>
        <ProjectView key={projectId} projectId={projectId} />
      </Boundary>
    )
  })
