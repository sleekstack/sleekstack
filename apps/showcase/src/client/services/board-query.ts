/**
 * apps/showcase/src/client/services/board-query.ts
 *
 * The board's client cache: one `board` query (its fetch is the `readBoard` Server Action, so the cached value is
 * the board DTO) and the three mutations. Each mutation resolves its Draft through `toDto`, writes optimistically
 * into the cached board (rolled back when the action reports `{ ok: false }`), and invalidates the board on success
 * so the server's ids and timestamps replace the optimistic placeholders. The page prefetches `board()` and hands it
 * over through `<HydrateQueries>`; nothing calls `router.refresh()`.
 */
import { Cause, Effect, Exit, Option } from 'effect'
import { Hydrate, Mutation, Queries, Query } from '@sleekstack/query'
import { addComment, createTask, moveTask, readBoard, type ActionResult } from '../../delivery/actions'
import type { TaskStatus } from '../../domain/entities'
import { resolveDraft, type DraftSpec } from '../../lib/contracts'
import { BoardDto, NewTaskDraft, TaskCommentDraft } from '../../models/task'

const boardFamily = Hydrate.hydratable(
  Query.make({ key: () => ['board'] as const, fetch: () => Effect.promise(() => readBoard()) }),
  { value: BoardDto },
)
/** The one board query (a family of one key). */
export const board = () => boardFamily(undefined)

const settle = <A>(r: ActionResult<A>) => (r.ok ? Effect.succeed(r.data) : Effect.fail(r.error))

/** A board mutation: resolve the input to its wire body, `send` it, show `patch` meanwhile, refetch the board on success. */
const boardMutation = <I, Dto, A>(
  toDto: (input: I) => Effect.Effect<Dto, string>,
  send: (dto: Dto) => Promise<ActionResult<A>>,
  patch: (dto: Dto, board: BoardDto) => BoardDto,
) =>
  Mutation.make({
    run: (input: I) => Effect.flatMap(toDto(input), (dto) => Effect.flatMap(Effect.promise(() => send(dto)), settle)),
    cancel: () => board(),
    onMutate: (input) =>
      Effect.flatMap(toDto(input), (dto) => Mutation.optimistic(board(), (prev) => patch(dto, Option.getOrElse(prev, (): BoardDto => [])))).pipe(
        // an invalid draft writes nothing; `run` reports it
        Effect.orElseSucceed(() => undefined),
      ),
    onSuccess: () => Effect.flatMap(Queries.Queries, (q) => Effect.sync(() => q.invalidate(board()))),
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
            { task: { id: pendingId('task'), projectId: dto.projectId, title: dto.title, status: 'todo' as const, createdAt: Date.now() }, comments: [] },
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
        : { ...t, comments: [...t.comments, { id: pendingId('comment'), taskId: dto.taskId, body: dto.body, authorId: dto.authorId, createdAt: Date.now() }] },
    ),
  })),
)

export const moveTaskMutation = boardMutation((input: { readonly taskId: string; readonly status: TaskStatus }) => Effect.succeed(input), moveTask, (dto, b) =>
  b.map((p) => ({ ...p, tasks: p.tasks.map((t) => (t.task.id === dto.taskId ? { ...t, task: { ...t.task, status: dto.status } } : t)) })),
)

/** The message of a settled call's typed failure, or null on success or interruption. */
export const failureOf = <A>(exit: Exit.Exit<A, string>): string | null =>
  Exit.isSuccess(exit) ? null : Option.getOrNull(Cause.failureOption(exit.cause))
