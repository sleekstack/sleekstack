'use client'
/**
 * apps/showcase/src/client/components/TaskDetail.tsx
 *
 * R7: mounts with `key={taskId}` (plus the "break detail" flag, since both
 * must remount together — `provide` changes alone are ignored,
 * packages/react/src/LayerProvider.tsx:133) providing the async `DraftEditor`
 * component service. Move/comment run `moveTaskMutation` / `addCommentMutation`
 * (optimistic writes into the cached board) and render an action's
 * `{ ok: false, error }` inline (R5).
 */
import { Suspense, useState } from 'react'
import { LayerProvider, useAtom, useService } from '@sleekstack/react'
import type { TaskStatus } from '../../domain/tags'
import type { CommentModel, TaskModel } from '../../models/task'
import { addCommentMutation, moveTaskMutation } from '../services/board-query'
import { useBoardMutation } from '../services/useBoardMutation'
import { ErrorBoundary } from './ErrorBoundary'
import { DraftEditor, makeBrokenDraftEditorLayer, makeDraftEditorLayer } from '../services/component-services'

const STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done']

export function DraftEditorPanel({ taskId }: { readonly taskId: string }) {
  const { draft } = useService(DraftEditor)
  // The draft is an atom owned by the DraftEditor service, not local state. TaskDetail only renders on the client.
  const [body, setBody] = useAtom(draft)
  const [error, setError] = useState<string | null>(null)
  const { mutate, isPending: pending } = useBoardMutation(addCommentMutation)

  const submit = () => {
    mutate(
      { draft: { body }, src: { taskId, authorId: 'demo-user' } },
      {
        onSuccess: () => {
          setError(null)
          setBody('')
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <div>
      <textarea
        aria-label="new comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment"
      />
      <button type="button" onClick={submit} disabled={pending}>
        Comment
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export interface TaskDetailProps {
  readonly task: TaskModel
  readonly comments: readonly CommentModel[]
  readonly onClose: () => void
}

export function TaskDetail({ task, comments, onClose }: TaskDetailProps) {
  const [breakDetail, setBreakDetail] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const { mutate: moveTo, isPending: movePending } = useBoardMutation(moveTaskMutation)

  const move = (status: TaskStatus) => {
    moveTo(
      { taskId: task.id, status },
      { onSuccess: () => setMoveError(null), onError: (e) => setMoveError(e.message) },
    )
  }

  return (
    <LayerProvider
      key={`${task.id}:${breakDetail}`}
      provide={[breakDetail ? makeBrokenDraftEditorLayer(task.id) : makeDraftEditorLayer(task.id)]}
    >
      <ErrorBoundary>
        <section aria-label={`task detail: ${task.title}`}>
          <h3>{task.title}</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
          <div>
            Move to:{' '}
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={status === task.status || movePending}
                onClick={() => move(status)}
              >
                {status}
              </button>
            ))}
          </div>
          {moveError && <p role="alert">{moveError}</p>}
          <label>
            <input type="checkbox" checked={breakDetail} onChange={(e) => setBreakDetail(e.target.checked)} />
            Break detail (simulate failed scope acquisition)
          </label>
          <ul>
            {comments.map((comment) => (
              <li key={comment.id}>{comment.body}</li>
            ))}
          </ul>
          <Suspense fallback={<p>Loading draft editor…</p>}>
            <DraftEditorPanel taskId={task.id} />
          </Suspense>
        </section>
      </ErrorBoundary>
    </LayerProvider>
  )
}
