'use client'
/**
 * apps/showcase/src/client/ProjectView.tsx
 *
 * R7: the project-scope `LayerProvider`, nested under the app-level one
 * (providers.tsx) and parent to the task-detail `LayerProvider`
 * (TaskDetail.tsx). Provides the async `ProjectFilterStore` component
 * service, which owns the project's filter and selected-task state (not
 * just a `useState` in this component — that state must live for the
 * scope's lifetime and disappear with it); create-task calls the .2 Server
 * Action with the "Simulate failure" control (R5).
 */
import { Suspense, useSyncExternalStore, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayerProvider, useService } from '@sleekstack/react'
import { createTask } from '../server/board.actions'
import type { CommentRecord, ProjectRecord, TaskRecord } from '../domain/tags'
import { ProjectFilterStore, makeProjectFilterStoreLayer, type TaskStatusFilter } from './component-services'
import { TaskDetail } from './TaskDetail'

export interface TaskWithComments {
  readonly task: TaskRecord
  readonly comments: readonly CommentRecord[]
}

function ProjectBody({ project, tasks }: { readonly project: ProjectRecord; readonly tasks: readonly TaskWithComments[] }) {
  const store = useService(ProjectFilterStore)
  const filter = useSyncExternalStore(store.filter.subscribe, store.filter.get)
  const selectedTaskId = useSyncExternalStore(store.selectedTaskId.subscribe, store.selectedTaskId.get)
  const [title, setTitle] = useState('')
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const visible = filter === 'all' ? tasks : tasks.filter(({ task }) => task.status === filter)
  const selected = tasks.find(({ task }) => task.id === selectedTaskId)

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createTask({ projectId: project.id, title, simulateFailure })
      if (!result.ok) {
        setCreateError(result.error)
        return
      }
      setCreateError(null)
      setTitle('')
      router.refresh()
    })
  }

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
            <button type="button" onClick={() => store.selectedTaskId.set(task.id)}>
              {task.title} — {task.status} ({comments.length})
            </button>
          </li>
        ))}
      </ul>
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
