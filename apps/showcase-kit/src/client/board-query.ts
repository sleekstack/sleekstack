/**
 * apps/showcase-kit/src/client/board-query.ts
 *
 * The board's client cache through the kit facade: the `board` query (its fetch is the `readBoard` Server Action)
 * and one `mutation()` per board action, settling `{ ok: false, error }` into a rejection. `useBoardMutation` writes
 * the expected board into the cache first, drops only that call's write when the action fails, and invalidates the
 * board once no call is in flight so the server's ids and timestamps win. No mutation calls `router.refresh()`.
 */
import { cachedQuery, mutation } from '@sleekstack/kit'
import { useMutation, useQueryClient } from '@sleekstack/kit/react'
import type { ActionResult } from '@sleekstack/kit/next'
import { addComment, createTask, moveTask, readBoard, type AddCommentInput, type CreateTaskInput, type MoveTaskInput } from '../server/board.actions'
import type { CommentRecord, ProjectRecord, TaskRecord } from '../domain/tags'

export interface BoardProject {
  readonly project: ProjectRecord
  readonly tasks: ReadonlyArray<{ readonly task: TaskRecord; readonly comments: readonly CommentRecord[] }>
}
export type BoardData = readonly BoardProject[]

const boardFamily = cachedQuery({
  key: () => ['board'] as const,
  fetch: function* () {
    return readBoard() as Promise<BoardData>
  },
})
/** The one board query (a family of one key). */
export const board = () => boardFamily(undefined)

const settled = <T>(result: Promise<ActionResult<T>>) =>
  result.then((r) => {
    if (!r.ok) throw new Error(r.error)
    return r.data
  })

export const createTaskMutation = mutation({ run: function* (input: CreateTaskInput) { return settled(createTask(input)) } })
export const moveTaskMutation = mutation({ run: function* (input: MoveTaskInput) { return settled(moveTask(input)) } })
export const addCommentMutation = mutation({ run: function* (input: AddCommentInput) { return settled(addComment(input)) } })

// The cached board is `base` with every in-flight call's patch applied, oldest first. A failed call drops only its own
// patch and recomputes, so overlapping rollbacks never wipe a later write; a committed patch folds into `base` once
// every older one has settled.
// ponytail: one log per module (the app has one query store); a demo-mode remount mid-call keeps the old base until it settles.
interface Layer {
  readonly patch: (b: BoardData) => BoardData
  committed: boolean
}
let log: { base: BoardData; layers: Layer[] } | undefined

/**
 * Runs a board mutation with an optimistic `patch` of the cached board, rolled back on failure.
 *
 * @returns `run` (resolves with the failure message, or null on success) and `isPending`.
 */
export function useBoardMutation<I, T>(m: Parameters<typeof useMutation<I, T>>[0], patch: (input: I, board: BoardData) => BoardData) {
  const { mutate, isPending } = useMutation(m)
  const client = useQueryClient()
  const run = async (input: I): Promise<string | null> => {
    const q = board()
    const current = client.getData(q)
    const layer: Layer = { patch: (b) => patch(input, b), committed: false }
    const render = () => log && client.setData(q, log.layers.reduce((b, l) => l.patch(b), log.base))
    if (current) {
      log ??= { base: current, layers: [] }
      log.layers.push(layer)
      render()
    }
    const settle = (ok: boolean) => {
      if (!log || !log.layers.includes(layer)) return
      if (ok) layer.committed = true
      else {
        log.layers.splice(log.layers.indexOf(layer), 1)
        render()
      }
      while (log.layers[0]?.committed) log.base = log.layers.shift()!.patch(log.base)
      if (log.layers.length === 0) log = undefined
    }
    try {
      await mutate(input)
      settle(true)
      return null
    } catch (e) {
      settle(false)
      return e instanceof Error ? e.message : String(e)
    } finally {
      // refetch once nothing is in flight, so the server's board never lands under a pending patch
      if (!log) client.invalidate(q)
    }
  }
  return { run, isPending }
}

const PENDING = '_pending_'
const pendingId = (prefix: string) => `${prefix}${PENDING}${Date.now()}`
/** An optimistic placeholder: not selectable, since the refetch replaces it with the saved record. */
export const isPendingId = (id: string) => id.includes(PENDING)

export const addTask = (input: CreateTaskInput, b: BoardData): BoardData =>
  b.map((p) =>
    p.project.id !== input.projectId
      ? p
      : { ...p, tasks: [...p.tasks, { task: { id: pendingId('task'), projectId: input.projectId, title: input.title.trim(), status: 'todo', createdAt: Date.now() }, comments: [] }] },
  )

export const setStatus = (input: MoveTaskInput, b: BoardData): BoardData =>
  b.map((p) => ({ ...p, tasks: p.tasks.map((t) => (t.task.id === input.taskId ? { ...t, task: { ...t.task, status: input.status } } : t)) }))

export const addCommentTo = (input: AddCommentInput, b: BoardData): BoardData =>
  b.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) =>
      t.task.id !== input.taskId
        ? t
        : { ...t, comments: [...t.comments, { id: pendingId('comment'), taskId: input.taskId, body: input.body.trim(), authorId: input.authorId, createdAt: Date.now() }] },
    ),
  }))
