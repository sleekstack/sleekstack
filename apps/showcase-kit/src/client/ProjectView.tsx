'use client'
/**
 * apps/showcase-kit/src/client/ProjectView.tsx
 *
 * R7: the project-scope `LayerProvider`, nested under the app-level one
 * (providers.tsx) and parent to the task-detail `LayerProvider`
 * (TaskDetail.tsx). Provides the async `ProjectFilterStore` component
 * service, which owns the project's filter and selected-task state (not
 * just a `useState` in this component — that state must live for the
 * scope's lifetime and disappear with it); create-task runs `createTaskMutation`
 * (optimistic, rolled back on the "Simulate failure" control's rejection, R5).
 */
import { Suspense, useSyncExternalStore, useState } from 'react'
import { LayerProvider, useService } from '@sleekstack/kit/react'
import { addTask, createTaskMutation, useBoardMutation, isPendingId } from './board-query'
import type { CommentRecord, ProjectRecord, TaskRecord } from '../domain/tags'
import { ProjectFilterStore, makeProjectFilterStoreLayer, type TaskStatusFilter } from './component-services'
import { TaskDetail } from './TaskDetail'

export interface TaskWithComments {
  readonly task: TaskRecord
  readonly comments: readonly CommentRecord[]
}

function CreateTaskForm({ project }: { readonly project: ProjectRecord }) {
  const [title, setTitle] = useState('')
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const { run, isPending: pending } = useBoardMutation(createTaskMutation, addTask)
  const submitCreate = () => {
    setTitle('') // the task shows optimistically, so the input is free for the next one
    void run({ projectId: project.id, title, simulateFailure }).then(setCreateError)
  }

  return (
    <div>
      <input
        aria-label={`new task title (${project.name})`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task title"
      />
      <label>
        <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
        Simulate failure
      </label>
      <button type="button" onClick={submitCreate} disabled={pending}>
        Create task
      </button>
      {createError && <p role="alert">{createError}</p>}
    </div>
  )
}

function ProjectBody({ project, tasks }: { readonly project: ProjectRecord; readonly tasks: readonly TaskWithComments[] }) {
  const store = useService(ProjectFilterStore)
  // `getServerSnapshot` (3rd arg): the store is per-mount and always starts
  // at these values, so the server snapshot is the same accessor as the
  // client one — required explicitly or React throws under SSR.
  const filter = useSyncExternalStore(store.filter.subscribe, store.filter.get, store.filter.get)
  const selectedTaskId = useSyncExternalStore(store.selectedTaskId.subscribe, store.selectedTaskId.get, store.selectedTaskId.get)

  const visible = filter === 'all' ? tasks : tasks.filter(({ task }) => task.status === filter)
  const selected = tasks.find(({ task }) => task.id === selectedTaskId)

  return (
    <section aria-label={`project: ${project.name}`}>
      <h2>{project.name}</h2>
      <label>
        Filter:{' '}
        <select value={filter} onChange={(e) => store.filter.set(e.target.value as TaskStatusFilter)}>
          <option value="all">all</option>
          <option value="todo">todo</option>
          <option value="in_progress">in_progress</option>
          <option value="done">done</option>
        </select>
      </label>
      <ul>
        {visible.map(({ task, comments }) => (
          <li key={task.id}>
            <button type="button" disabled={isPendingId(task.id)} onClick={() => store.selectedTaskId.set(task.id)}>
              {task.title} — {task.status} ({comments.length})
            </button>
          </li>
        ))}
      </ul>
      <CreateTaskForm project={project} />
      {selected && (
        <TaskDetail task={selected.task} comments={selected.comments} onClose={() => store.selectedTaskId.set(null)} />
      )}
    </section>
  )
}

export interface ProjectViewProps {
  readonly project: ProjectRecord
  readonly tasks: readonly TaskWithComments[]
}

export function ProjectView({ project, tasks }: ProjectViewProps) {
  return (
    <LayerProvider provide={[makeProjectFilterStoreLayer(project.id)]}>
      <Suspense fallback={<p>Loading project…</p>}>
        <ProjectBody project={project} tasks={tasks} />
      </Suspense>
    </LayerProvider>
  )
}
