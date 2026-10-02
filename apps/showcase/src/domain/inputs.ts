/**
 * apps/showcase/src/domain/inputs.ts
 *
 * One zod schema per input: the client Drafts validate with these, the server re-parses with them.
 */
import { z } from 'zod'

export const CreateTask = z.object({
  projectId: z.string(),
  title: z.string().trim().min(1, 'Please enter a title'),
  simulateFailure: z.boolean().optional(),
})
export type CreateTask = z.infer<typeof CreateTask>

export const MoveTask = z.object({
  taskId: z.string(),
  status: z.enum(['todo', 'in_progress', 'done']),
})
export type MoveTask = z.infer<typeof MoveTask>

export const AddComment = z.object({
  taskId: z.string(),
  body: z.string().trim().min(1, 'Please enter a comment'),
  authorId: z.string(),
})
export type AddComment = z.infer<typeof AddComment>
