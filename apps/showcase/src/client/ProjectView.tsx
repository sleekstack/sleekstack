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
import { Suspense, useMemo, useSyncExternalStore, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayerProvider, useService } from '@sleekstack/react'
import { createTask } from '../server/board.actions'
import type { ProjectRecord } from '../domain/tags'
import { ProjectFilterStore, makeProjectFilterStoreLayer, type TaskStatusFilter } from './component-services'
import { TaskDetail } from './TaskDetail'
import { useDraftForm } from './useDraftForm'
import { submitDraft } from '../models/contracts'
import { NewTaskDraft, type CommentModel, type TaskModel } from '../models/task'

export interface TaskWithComments {
  readonly task: TaskModel
  readonly comments: readonly CommentModel[]
}

function ProjectBody({ project, tasks }: { readonly project: ProjectRecord; readonly tasks: readonly TaskWithComments[] }) {
  const store = useService(ProjectFilterStore)
  // `getServerSnapshot` (3rd arg): the store is per-mount and always starts
  // at these values, so the server snapshot is the same accessor as the
  // client one — required explicitly or React throws under SSR.
  const filter = useSyncExternalStore(store.filter.subscribe, store.filter.get, store.filter.get)
  const selectedTaskId = useSyncExternalStore(store.selectedTaskId.subscribe, store.selectedTaskId.get, store.selectedTaskId.get)
  const newTaskCtx = useMemo(() => ({ projectId: project.id }), [project.id])
  const form = useDraftForm(NewTaskDraft, newTaskCtx)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const visible = filter === 'all' ? tasks : tasks.filter(({ task }) => task.status === filter)
  const selected = tasks.find(({ task }) => task.id === selectedTaskId)

  const submitCreate = form.handleSubmit((draft) => {
    startTransition(async () => {
      const result = await submitDraft(NewTaskDraft, draft, newTaskCtx, createTask)
      if (!result.ok) {
        setCreateError(result.error)
        return
      }
      setCreateError(null)
      form.reset()
      router.refresh()
    })
  })

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
              {task.title} — {task.statusLabel} ({comments.length})
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submitCreate} noValidate>
        <input aria-label={`new task title (${project.name})`} placeholder="New task title" {...form.register('title')} />
        {form.formState.errors.title && <p role="alert">{form.formState.errors.title.message}</p>}
        <label>
          <input type="checkbox" {...form.register('simulateFailure')} />
          Simulate failure
        </label>
        <button type="submit" disabled={pending}>
          Create task
        </button>
        {createError && <p role="alert">{createError}</p>}
      </form>
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
