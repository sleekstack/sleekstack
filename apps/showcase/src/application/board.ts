/**
 * apps/showcase/src/application/board.ts
 *
 * The board's use cases. Each parses its input with the domain schema, takes ids and timestamps from the
 * per-call IdGen/Clock (so demo overrides apply), writes inside one BoardStore transaction, and records the
 * audit entry only after that transaction commits.
 */
import 'server-only'
import { Effect } from 'effect'
import type { z } from 'zod'
import { InvalidInput, SimulatedFailure } from '../domain/errors'
import { AddComment, CreateTask, MoveTask } from '../domain/inputs'
import { ActivityLog, BoardStore, Clock, IdGen, RequestContext } from '../domain/tags'
import { loadBoard } from './board-view'

/** Server-facing wording per field; the rule itself lives only in the domain schema. */
const SERVER_MESSAGES: Record<string, string> = { title: 'Task title cannot be empty', body: 'Comment body cannot be empty' }

/** Parses with the domain schema; the first issue becomes the `InvalidInput` message. */
const parse = <S extends z.ZodType>(schema: S, input: unknown): Effect.Effect<z.output<S>, InvalidInput> => {
  const r = schema.safeParse(input)
  if (r.success) return Effect.succeed(r.data)
  const issue = r.error.issues[0]
  return Effect.fail(new InvalidInput({ message: SERVER_MESSAGES[String(issue?.path[0])] ?? issue?.message ?? 'Invalid input' }))
}

const createTask = (input: CreateTask) =>
  Effect.gen(function* () {
    yield* RequestContext
    const { projectId, title, simulateFailure } = yield* parse(CreateTask, input)
    const record = { id: (yield* IdGen).next('task'), projectId, title, status: 'todo' as const, createdAt: (yield* Clock).now() }
    const created = yield* (yield* BoardStore).transaction((tx) =>
      Effect.flatMap(tx.createTask(record), (task) =>
        simulateFailure ? new SimulatedFailure({ message: 'Simulated failure: create rejected before commit' }) : Effect.succeed(task)),
    )
    ;(yield* ActivityLog).record(`Task created: ${created.id} "${created.title}"`)
    return created
  })

const moveTask = (input: MoveTask) =>
  Effect.gen(function* () {
    yield* RequestContext
    const { taskId, status } = yield* parse(MoveTask, input)
    const moved = yield* (yield* BoardStore).transaction((tx) => tx.moveTask(taskId, status))
    ;(yield* ActivityLog).record(`Task moved: ${moved.id} -> ${moved.status}`)
    return moved
  })

const addComment = (input: AddComment) =>
  Effect.gen(function* () {
    yield* RequestContext
    const { taskId, body, authorId } = yield* parse(AddComment, input)
    const record = { id: (yield* IdGen).next('comment'), taskId, body, authorId, createdAt: (yield* Clock).now() }
    const created = yield* (yield* BoardStore).transaction((tx) => tx.addComment(record))
    ;(yield* ActivityLog).record(`Comment added: ${created.id} on ${taskId}`)
    return created
  })

/** Exactly four operations (R2). */
export const Board = { loadBoard, createTask, moveTask, addComment } as const
