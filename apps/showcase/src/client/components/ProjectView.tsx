'use client'
/**
 * apps/showcase/src/client/components/ProjectView.tsx
 *
 * R7: the project-scope `LayerProvider`, nested under the app-level one
 * (providers.tsx) and parent to the task-detail `LayerProvider`
 * (TaskDetail.tsx). Provides the async `ProjectFilterStore` component
 * service, which owns the project's filter and selected-task state (not
 * just a `useState` in this component — that state must live for the
 * scope's lifetime and disappear with it); create-task runs `createTaskMutation`
 * (optimistic, rolled back on the "Simulate failure" control's rejection, R5).
 */
import { Suspense, useMemo, useSyncExternalStore, useState } from 'react'
import { LayerProvider, useService } from '@sleekstack/react'
import { createTaskMutation, isPendingId } from '../services/board-query'
import { useBoardMutation } from '../services/useBoardMutation'
import type { ProjectRecord } from '../../domain/tags'
import { ProjectFilterStore, makeProjectFilterStoreLayer, type TaskStatusFilter } from '../services/component-services'
import { TaskDetail } from './TaskDetail'
import { useDraftForm } from '../drafts/useDraftForm'
import { NewTaskDraft, type CommentModel, type TaskModel } from '../../models/task'

export interface TaskWithComments {
  readonly task: TaskModel
  readonly comments: readonly CommentModel[]
}

function ProjectBody({
  project,
  tasks,
}: {
  readonly project: ProjectRecord
  readonly tasks: readonly TaskWithComments[]
}) {
  const store = useService(ProjectFilterStore)
  // `getServerSnapshot` (3rd arg): the store is per-mount and always starts
  // at these values, so the server snapshot is the same accessor as the
  // client one — required explicitly or React throws under SSR.
  const filter = useSyncExternalStore(store.filter.subscribe, store.filter.get, store.filter.get)
  const selectedTaskId = useSyncExternalStore(
    store.selectedTaskId.subscribe,
    store.selectedTaskId.get,
    store.selectedTaskId.get,
  )
  const newTaskCtx = useMemo(() => ({ projectId: project.id }), [project.id])
  const form = useDraftForm(NewTaskDraft, newTaskCtx)
  const [createError, setCreateError] = useState<string | null>(null)
  const { mutate, isPending: pending } = useBoardMutation(createTaskMutation)

  const visible = filter === 'all' ? tasks : tasks.filter(({ task }) => task.status === filter)
  const selected = tasks.find(({ task }) => task.id === selectedTaskId)

  const submitCreate = form.handleSubmit(
    (draft) => {
      form.reset() // the task shows optimistically, so the form is free for the next one
      mutate(
        { draft, src: newTaskCtx },
        { onSuccess: () => setCreateError(null), onError: (e) => setCreateError(e.message) },
      )
    },
    () => setCreateError(null),
  )

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
              {task.title} — {task.statusLabel} ({comments.length})
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submitCreate} noValidate>
        <input
          aria-label={`new task title (${project.name})`}
          placeholder="New task title"
          {...form.register('title')}
        />
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
