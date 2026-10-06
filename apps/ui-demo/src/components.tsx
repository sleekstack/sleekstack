/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, Pending, useAtomValue, useLocal, useSetAtom } from '@sleekstack/ui'
import { type QueryFailed, useSuspenseTasks, useTaskActions } from './tasks'
import { AddTaskForm, Avatar, FilterBar, Votes } from './guests'
import { filterAtom, projectAtom, selectedAtom } from './state'
import {
  type Priority,
  ProjectNotFound,
  type Status,
  type Task,
  TaskNotFound,
  TaskRepo,
  UserNotFound,
  UserRepo,
  Viewer,
} from './domain'

const STATUSES: ReadonlyArray<Status> = ['todo', 'in_progress', 'done']
const LABEL: Record<Status, string> = {todo: 'To do', in_progress: 'In progress', done: 'Done'}
/** Project ids saved in the nav; `p0` was archived since. */
const BOOKMARKS: ReadonlyArray<string> = ['p1', 'p2', 'p0']

export const StatusBadge = ({status}: { status: Status }) => (
  <span className={`badge ${status}`}>{LABEL[status]}</span>
)
const PriorityBadge = ({priority}: { priority: Priority }) => <span className={`priority ${priority}`}>{priority}</span>

/** Needs UserRepo and Viewer; fails with UserNotFound. */
export const Assignee = ({id}: { id: string }) =>
  Effect.gen(function* () {
    const user = yield* UserRepo.get(id)
    const {user: viewer} = yield* Viewer
    return yield* (
      <>
        <Avatar name={user.name}/>
        <span>{user.name}</span>
        {viewer.id === user.id && <em className="you">you</em>}
      </>
    )
  })

const MaybeAssignee = ({id}: { id: string | null }) => (
  <Boundary tag="UserNotFound" fallback={(_: UserNotFound) => <span className="muted">Left the team</span>}>
    {id ? <Assignee id={id}/> : <span className="muted">Unassigned</span>}
  </Boundary>
)

export const TaskCard = ({task}: { task: Task }) =>
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
          <PriorityBadge priority={task.priority}/>
          {task.due && <time dateTime={task.due}>{task.due}</time>}
          {task.labels.map((l) => (
            <span key={l} className="label">
              {l}
            </span>
          ))}
        </div>
        <div className="row">
          <MaybeAssignee id={task.assigneeId}/>
          <Votes initial={task.votes}/>
        </div>
      </article>
    )
  })

export const StatusColumn = ({status, tasks}: { status: Status; tasks: ReadonlyArray<Task> }) => (
  <section className="column">
    <h3>
      {LABEL[status]} <small>{tasks.length}</small>
    </h3>
    {tasks.map((t) => (
      <TaskCard key={t.id} task={t}/>
    ))}
    {tasks.length === 0 && <p className="muted">Nothing here</p>}
  </section>
)

/** Re-runs when the status filter changes. */
const Columns = ({tasks}: { tasks: ReadonlyArray<Task> }) =>
  Effect.gen(function* () {
    const filter = yield* useAtomValue(filterAtom)
    return yield* (
      <div className="columns">
        {STATUSES.filter((s) => filter === 'all' || filter === s).map((s) => (
          <StatusColumn key={s} status={s} tasks={tasks.filter((t) => t.status === s)}/>
        ))}
      </div>
    )
  })

/** Instance-local search, sort order and collapse; the keyed rows keep their nodes and guests when they reorder. */
const Triage = ({tasks}: { tasks: ReadonlyArray<Task> }) =>
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
        <input
          className="search"
          placeholder="Search"
          onInput={(e: Event) => Effect.sync(() => setQuery((e.target as HTMLInputElement).value))}
        />
        <button type="button" className="sort" onClick={() => Effect.sync(() => setDesc((d) => !d))}>
          {desc ? 'Z-A' : 'A-Z'}
        </button>
        {open && (
          <ul className="triage-list">
            {shown.map((t) => (
              <li key={t.id} data-id={t.id}>
                {t.title} <Votes initial={t.votes}/>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  })

/** Sets the status filter from guest buttons; reads no atom, so it never re-runs. */
const Toolbar = () =>
  Effect.gen(function* () {
    const setFilter = yield* useSetAtom(filterAtom)
    return yield* (
      <nav className="toolbar">
        <FilterBar options={['all', ...STATUSES]} onPick={setFilter}/>
      </nav>
    )
  })

/** The open task, from the project's tasks; only editors can move or delete it. Fails with `TaskNotFound` when it is gone. */
const Detail = ({projectId, tasks}: { projectId: string; tasks: ReadonlyArray<Task> }) =>
  Effect.gen(function* () {
    const id = yield* useAtomValue(selectedAtom)
    if (id === null) return yield* (<p className="detail muted">Select a task</p>)
    const task = tasks.find((t) => t.id === id)
    if (!task) return yield* Effect.fail(new TaskNotFound({id}))
    const {user: viewer} = yield* Viewer
    const {move, remove} = yield* useTaskActions(projectId)
    return yield* (
      <aside className="detail">
        <h2>{task.title}</h2>
        <StatusBadge status={task.status}/>
        <MaybeAssignee id={task.assigneeId}/>
        {viewer.canEdit ? (
          <div className="row actions">
            {STATUSES.filter((s) => s !== task.status).map((s) => (
              <button key={s} type="button" className="move" data-status={s}
                      onClick={() => Effect.sync(() => move.mutate({id: task.id, status: s}))}>
                Move to {LABEL[s]}
              </button>
            ))}
            <button type="button" className="delete" onClick={() => Effect.sync(() => remove.mutate(task.id))}>
              Delete
            </button>
          </div>
        ) : (
          <p className="muted">Read only</p>
        )}
      </aside>
    )
  })

const DetailPanel = ({projectId, tasks}: { projectId: string; tasks: ReadonlyArray<Task> }) => (
  <div className="selected">
    <Boundary tag="TaskNotFound" fallback={(_: TaskNotFound) => <p className="error">This task no longer exists</p>}>
      <Detail projectId={projectId} tasks={tasks}/>
    </Boundary>
  </div>
)

/** Hands `mutate` to the React form; re-runs only on its own mutation's status. Editors only. */
const NewTask = ({projectId}: { projectId: string }) =>
  Effect.gen(function* () {
    const {user: viewer} = yield* Viewer
    if (!viewer.canEdit) return yield* (<p className="muted">Read only: {viewer.name} cannot add tasks</p>)
    const {add} = yield* useTaskActions(projectId)
    return yield* <AddTaskForm onAdd={(task) => add.mutate(task)}/>
  })

/** Waits on the project's tasks through the query cache (under `Pending`). */
const Workspace = ({projectId}: { projectId: string }) =>
  Effect.gen(function* () {
    const tasks = yield* useSuspenseTasks(projectId)
    return yield* (
      <div className="workspace">
        <Toolbar/>
        <Columns tasks={tasks}/>
        <DetailPanel projectId={projectId} tasks={tasks}/>
        <Triage tasks={tasks}/>
      </div>
    )
  })

/** Needs TaskRepo; fails with ProjectNotFound for an unknown or archived project. */
const ProjectView = ({projectId}: { projectId: string }) =>
  Effect.gen(function* () {
    const project = yield* TaskRepo.project(projectId)
    return yield* (
      <section className="board">
        <h2>{project.name}</h2>
        <NewTask projectId={projectId}/>
        <Boundary tag="QueryFailed" fallback={(_: QueryFailed) => <p className="error">Tasks failed to load</p>}>
          <Pending fallback={<p className="muted spinner">Loading tasks</p>}>
            <Workspace projectId={projectId}/>
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
        <ProjectView key={projectId} projectId={projectId}/>
      </Boundary>
    )
  })

/** Saved project links. Opening one clears the open task and the status filter. */
export const ProjectNav = () =>
  Effect.gen(function* () {
    const known = yield* TaskRepo.projects()
    const current = yield* useAtomValue(projectAtom)
    const setProject = yield* useSetAtom(projectAtom)
    const select = yield* useSetAtom(selectedAtom)
    const setFilter = yield* useSetAtom(filterAtom)
    const open = (id: string) =>
      Effect.sync(() => {
        setProject(id)
        select(null)
        setFilter('all')
      })
    return yield* (
      <nav className="projects">
        {BOOKMARKS.map((id) => (
          <button key={id} type="button" className={id === current ? 'project current' : 'project'} data-project={id}
                  onClick={() => open(id)}>
            {known.find((p) => p.id === id)?.name ?? 'Old roadmap'}
          </button>
        ))}
      </nav>
    )
  })

export const Team = () =>
  Effect.gen(function* () {
    const users = yield* UserRepo.all()
    return yield* (
      <ul className="team">
        {users.map((u) => (
          <li key={u.id}>
            <Avatar name={u.name}/> {u.name}
          </li>
        ))}
      </ul>
    )
  })

export const Header = () =>
  Effect.gen(function* () {
    const {user: viewer} = yield* Viewer
    return yield* (
      <header>
        <h1>SleekStack board</h1>
        <Avatar name={viewer.name}/>
      </header>
    )
  })
