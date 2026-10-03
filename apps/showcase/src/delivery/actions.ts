'use server'
/**
 * apps/showcase/src/delivery/actions.ts
 *
 * The board's Server Actions (R5): `readBoard` is the board query's fetch (the client cache's read), and each
 * mutating action is one application of `act` to a Board use case.
 */
import { Board } from '../application/board'
import type { AddComment, CreateTask, MoveTask } from '../domain/inputs'
import { act } from './act.server'
import { runApp } from './runtime.server'

export type { ActionResult } from './act.server'
export type CreateTaskInput = CreateTask
export type MoveTaskInput = MoveTask
export type AddCommentInput = AddComment

export const readBoard = async () => runApp(Board.loadBoard)

export const createTask = act(Board.createTask)

export const moveTask = act(Board.moveTask)

export const addComment = act(Board.addComment)
