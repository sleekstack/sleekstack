/**
 * apps/showcase/src/domain/inputs.ts
 *
 * One Effect Schema per input: the client Drafts validate with these, the server re-parses with them.
 */
import { Schema } from 'effect'

const NonEmpty = (message: string) => Schema.Trim.pipe(Schema.minLength(1, { message: () => message }))

export const CreateTask = Schema.Struct({
  projectId: Schema.String,
  title: NonEmpty('Please enter a title'),
  simulateFailure: Schema.optional(Schema.Boolean),
})
export type CreateTask = typeof CreateTask.Type

export const MoveTask = Schema.Struct({
  taskId: Schema.String,
  status: Schema.Literal('todo', 'in_progress', 'done'),
})
export type MoveTask = typeof MoveTask.Type

export const AddComment = Schema.Struct({
  taskId: Schema.String,
  body: NonEmpty('Please enter a comment'),
  authorId: Schema.String,
})
export type AddComment = typeof AddComment.Type
