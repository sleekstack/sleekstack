/**
 * apps/showcase/src/client/services/board-query.ts
 *
 * The board's client cache: one `board` query (its fetch is the `readBoard` Server Action, so the cached value is
 * the board DTO) and the three mutations' specs. Each mutation resolves its Draft through `toDto`, writes optimistically
 * into the cached board (rolled back when the action reports `{ ok: false }` or rejects), and invalidates the board on
 * settle so the server's ids and timestamps replace the optimistic placeholders. The page prefetches `boardOptions` and
 * hands it over through `<HydrationBoundary>`; nothing calls `router.refresh()`. `useBoardMutation` runs a spec.
 */
import { Cause, Effect, Exit, Option } from 'effect'
import { queryOptions } from '@tanstack/react-query'
import { addComment, createTask, moveTask, readBoard, type ActionResult } from '../../delivery/actions'
import type { TaskStatus } from '../../domain/entities'
import { resolveDraft, type DraftSpec } from '../../lib/contracts'
import { BoardDto, NewTaskDraft, TaskCommentDraft } from '../../models/task'

/** The one board query. */
export const boardOptions = queryOptions({
  queryKey: ['board'] as const,
  queryFn: (): Promise<BoardDto> => readBoard(),
})

const settle = <A>(r: ActionResult<A>) => (r.ok ? Effect.succeed(r.data) : Effect.fail(r.error))

/** Runs `effect`, rejecting with an `Error` carrying its typed failure's message. */
const run = async <A>(effect: Effect.Effect<A, string>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return exit.value
  throw new Error(Option.getOrElse(Cause.failureOption(exit.cause), () => Cause.pretty(exit.cause)))
}

/** A board mutation spec: `mutationFn` resolves the input and sends it; `patch` (null for an invalid draft) is the optimistic write. */
export type BoardMutation<I> = {
  readonly mutationFn: (input: I) => Promise<unknown>
  readonly patch: (input: I, board: BoardDto) => BoardDto | null
}

const boardMutation = <I, Dto, A>(
  toDto: (input: I) => Effect.Effect<Dto, string>,
  send: (dto: Dto) => Promise<ActionResult<A>>,
  patch: (dto: Dto, board: BoardDto) => BoardDto,
): BoardMutation<I> => ({
  mutationFn: (input) =>
    run(
      Effect.flatMap(toDto(input), (dto) =>
        Effect.flatMap(
          Effect.tryPromise({ try: () => send(dto), catch: (e) => (e instanceof Error ? e.message : String(e)) }),
          settle,
        ),
      ),
    ),
  patch: (input, board) =>
    Effect.runSync(Effect.match(toDto(input), { onFailure: () => null, onSuccess: (dto) => patch(dto, board) })),
})

/** A Draft input: the form state plus its context, resolved through the Draft's `toDto`. */
const draftInput =
  <D, Dto, Src>(spec: DraftSpec<D, Dto, Src>) =>
  ({ draft, src }: { readonly draft: D; readonly src: Src }) =>
    Effect.mapError(resolveDraft(spec, draft, src), (e) => e.message)

const PENDING = '_pending_'
const pendingId = (prefix: string) => `${prefix}${PENDING}${Date.now()}`
/** An optimistic placeholder: not selectable, since the refetch replaces it with the saved record. */
export const isPendingId = (id: string) => id.includes(PENDING)

export const createTaskMutation = boardMutation(draftInput(NewTaskDraft), createTask, (dto, b) =>
  b.map((p) =>
    p.project.id !== dto.projectId
      ? p
      : {
          ...p,
          tasks: [
            ...p.tasks,
            {
              task: {
                id: pendingId('task'),
                projectId: dto.projectId,
                title: dto.title,
                status: 'todo' as const,
                createdAt: Date.now(),
              },
              comments: [],
            },
          ],
        },
  ),
)

export const addCommentMutation = boardMutation(draftInput(TaskCommentDraft), addComment, (dto, b) =>
  b.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) =>
      t.task.id !== dto.taskId
        ? t
        : {
            ...t,
            comments: [
              ...t.comments,
              {
                id: pendingId('comment'),
                taskId: dto.taskId,
                body: dto.body,
                authorId: dto.authorId,
                createdAt: Date.now(),
              },
            ],
          },
    ),
  })),
)

export const moveTaskMutation = boardMutation(
  (input: { readonly taskId: string; readonly status: TaskStatus }) => Effect.succeed(input),
  moveTask,
  (dto, b) =>
    b.map((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.task.id === dto.taskId ? { ...t, task: { ...t.task, status: dto.status } } : t)),
    })),
)
