'use server'
/**
 * apps/showcase/src/delivery/actions.ts
 *
 * The board's mutating Server Actions (R5): each is one application of `act` to a Board use case.
 */
import { Board } from '../application/board'
import type { AddComment, CreateTask, MoveTask } from '../domain/inputs'
import { act } from './act.server'

export type { ActionResult } from './act.server'
export type CreateTaskInput = CreateTask
export type MoveTaskInput = MoveTask
export type AddCommentInput = AddComment

export const createTask = act(Board.createTask)

export const moveTask = act(Board.moveTask)

export const addComment = act(Board.addComment)
