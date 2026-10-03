/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, Provider, useAtomValue, useSetAtom } from '@sleekstack/ui'
import { Avatar, FilterBar, Votes } from './guests'
import { filterAtom, selectedAtom } from './state'
import {
  ProjectNotFound, TaskNotFound, TaskRepo, UserNotFound, UserRepo, Viewer, ViewerLive,
  type Status, type Task,
} from './domain'

const STATUSES: ReadonlyArray<Status> = ['todo', 'in_progress', 'done']
const LABEL: Record<Status, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

export const StatusBadge = ({ status }: { status: Status }) => <span className={`badge ${status}`}>{LABEL[status]}</span>

/** Needs UserRepo and Viewer; fails with UserNotFound. */
export const Assignee = ({ id }: { id: string }) =>
  Effect.gen(function* () {
    const user = yield* UserRepo.get(id)
    const { user: viewer } = yield* Viewer
    return yield* (
      <>
        <Avatar name={user.name} />
        <span>{user.name}</span>
        {viewer.id === user.id && <em className="you">you</em>}
      </>
    )
  })

const MaybeAssignee = ({ id }: { id: string | null }) => (
  <Boundary tag="UserNotFound" fallback={(e: UserNotFound) => <span className="muted">Unknown user {e.id}</span>}>
    {id ? <Assignee id={id} /> : <span className="muted">Unassigned</span>}
  </Boundary>
)

export const TaskCard = ({ task }: { task: Task }) => (
  <article className="card">
    <h4>{task.title}</h4>
    <div className="row">
      <MaybeAssignee id={task.assigneeId} />
      <Votes initial={task.votes} />
    </div>
  </article>
)

export const StatusColumn = ({ status, tasks }: { status: Status; tasks: ReadonlyArray<Task> }) => (
  <section className="column">
    <h3>
      {LABEL[status]} <small>{tasks.length}</small>
    </h3>
    {tasks.map((t) => (
      <TaskCard task={t} />
    ))}
    {tasks.length === 0 && <p className="muted">Nothing here</p>}
  </section>
)

/** Needs TaskRepo, UserRepo and Viewer; fails with ProjectNotFound. */
export const Board = ({ projectId }: { projectId: string }) =>
  Effect.gen(function* () {
    const project = yield* TaskRepo.project(projectId)
    const tasks = yield* TaskRepo.byProject(projectId)
    return yield* (
      <section className="board">
        <h2>{project.name}</h2>
        <Columns tasks={tasks} />
      </section>
    )
  })

/** Re-runs when the status filter changes. */
const Columns = ({ tasks }: { tasks: ReadonlyArray<Task> }) =>
  Effect.gen(function* () {
    const filter = yield* useAtomValue(filterAtom)
    return yield* (
      <div className="columns">
        {STATUSES.filter((s) => filter === 'all' || filter === s).map((s) => (
          <StatusColumn status={s} tasks={tasks.filter((t) => t.status === s)} />
        ))}
      </div>
    )
  })

/** Sets the atoms from guest buttons; reads none, so it never re-runs. */
const Toolbar = () =>
  Effect.gen(function* () {
    const setFilter = yield* useSetAtom(filterAtom)
    const select = yield* useSetAtom(selectedAtom)
    return yield* (
      <nav className="toolbar">
        <FilterBar options={['all', ...STATUSES]} onPick={setFilter} />
        <FilterBar options={['t1', 't2', 't3', 'nope']} onPick={select} />
      </nav>
    )
  })

/** Re-runs when the selected task changes. */
const Selected = () =>
  Effect.gen(function* () {
    const id = yield* useAtomValue(selectedAtom)
    return yield* (
      <div className="selected">
        <DetailPanel id={id} />
      </div>
    )
  })

export const ProjectBoard = ({ projectId }: { projectId: string }) => (
  <Boundary tag="ProjectNotFound" fallback={(e: ProjectNotFound) => <p className="error">No project "{e.id}"</p>}>
    <Board projectId={projectId} />
  </Boundary>
)

export const TaskDetail = ({ id }: { id: string }) =>
  Effect.gen(function* () {
    const task = yield* TaskRepo.get(id)
    const { user: viewer } = yield* Viewer
    return yield* (
      <aside className="detail">
        <h2>{task.title}</h2>
        <StatusBadge status={task.status} />
        <MaybeAssignee id={task.assigneeId} />
        {viewer.canEdit ? <p className="muted">{viewer.name} can edit this task</p> : <p className="muted">Read only</p>}
      </aside>
    )
  })

export const DetailPanel = ({ id }: { id: string }) => (
  <Boundary tag="TaskNotFound" fallback={(e: TaskNotFound) => <p className="error">No task "{e.id}"</p>}>
    <TaskDetail id={id} />
  </Boundary>
)

export const Team = () =>
  Effect.gen(function* () {
    const users = yield* UserRepo.all()
    return yield* (
      <ul className="team">
        {users.map((u) => (
          <li>
            <Avatar name={u.name} /> {u.name}
          </li>
        ))}
      </ul>
    )
  })

const Header = () =>
  Effect.gen(function* () {
    const { user: viewer } = yield* Viewer
    return yield* (
      <header>
        <h1>SleekStack board</h1>
        <Avatar name={viewer.name} />
      </header>
    )
  })

/** The whole page, viewed as `viewer`: one `Provider` scopes the Viewer for every component under it. */
export const App = ({ viewer }: { viewer: string }) => (
  <Provider layer={ViewerLive(viewer)}>
    <Header />
    <Toolbar />
    <main>
      <Team />
      <ProjectBoard projectId="p1" />
      <ProjectBoard projectId="missing" />
      <Selected />
      <DetailPanel id="nope" />
    </main>
  </Provider>
)
