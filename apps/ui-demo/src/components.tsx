/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, Pending, useAtomValue, useLocal, useSetAtom } from '@sleekstack/ui'
import { useAddTask, useSuspenseBacklog, type QueryFailed } from './backlog'
import { AddButton, Avatar, FilterBar, Votes } from './guests'
import { filterAtom, selectedAtom } from './state'
import {
  MISSING_TASK, ProjectNotFound, TaskNotFound, TaskRepo, UserNotFound, UserRepo, Viewer,
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
      <TaskCard key={t.id} task={t} />
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
        <Triage tasks={tasks} />
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
          <StatusColumn key={s} status={s} tasks={tasks.filter((t) => t.status === s)} />
        ))}
      </div>
    )
  })

/** Instance-local search, sort order and collapse; the keyed rows keep their nodes and guests when they reorder. */
const Triage = ({ tasks }: { tasks: ReadonlyArray<Task> }) =>
  Effect.gen(function* () {
    const [query, setQuery] = yield* useLocal('')
    const [desc, setDesc] = yield* useLocal(false)
    const [open, setOpen] = yield* useLocal(true)
    const shown = tasks
      .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (desc ? -1 : 1) * a.title.localeCompare(b.title))
    return yield* (
      <section className="triage">
        <h3>
          <button type="button" className="collapse" onClick={() => Effect.sync(() => setOpen((o) => !o))}>
            {open ? 'Hide' : 'Show'} triage
          </button>
        </h3>
        <input className="search" placeholder="Search" onInput={(e: Event) => Effect.sync(() => setQuery((e.target as HTMLInputElement).value))} />
        <button type="button" className="sort" onClick={() => Effect.sync(() => setDesc((d) => !d))}>
          {desc ? 'Z-A' : 'A-Z'}
        </button>
        {open && (
          <ul className="triage-list">
            {shown.map((t) => (
              <li key={t.id} data-id={t.id}>
                {t.title} <Votes initial={t.votes} />
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  })

/** Sets the atoms from guest buttons; reads none, so it never re-runs. Needs TaskRepo. */
export const Toolbar = () =>
  Effect.gen(function* () {
    const setFilter = yield* useSetAtom(filterAtom)
    const select = yield* useSetAtom(selectedAtom)
    const ids = yield* TaskRepo.ids()
    return yield* (
      <nav className="toolbar">
        <FilterBar options={['all', ...STATUSES]} onPick={setFilter} />
        <FilterBar options={[...ids, MISSING_TASK]} onPick={select} />
      </nav>
    )
  })

/** Re-runs when the selected task changes. */
export const Selected = () =>
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
          <li key={u.id}>
            <Avatar name={u.name} /> {u.name}
          </li>
        ))}
      </ul>
    )
  })

/** Waits on the project's tasks through the query cache (under `Pending`); re-runs when the query result changes. */
const BacklogList = ({ projectId }: { projectId: string }) =>
  Effect.gen(function* () {
    const tasks = yield* useSuspenseBacklog(projectId)
    return yield* (
      <ul className="backlog">
        {tasks.map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
    )
  })

/** Hands `mutate` to a React guest; re-runs only on its own mutation's status. */
const AddTask = ({ projectId }: { projectId: string }) =>
  Effect.gen(function* () {
    const add = yield* useAddTask(projectId)
    return yield* <AddButton onAdd={() => add.mutate('New task')} />
  })

export const Backlog = ({ projectId }: { projectId: string }) => (
  <section className="backlog-panel">
    <h2>Backlog</h2>
    <AddTask projectId={projectId} />
    <Boundary tag="QueryFailed" fallback={(_: QueryFailed) => <p className="error">Backlog failed to load</p>}>
      <Pending fallback={<p className="muted spinner">Loading backlog</p>}>
        <BacklogList projectId={projectId} />
      </Pending>
    </Boundary>
  </section>
)

export const Header = () =>
  Effect.gen(function* () {
    const { user: viewer } = yield* Viewer
    return yield* (
      <header>
        <h1>SleekStack board</h1>
        <Avatar name={viewer.name} />
      </header>
    )
  })
